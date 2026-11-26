'use strict';

const { BadRequest, Conflict, NotFound } = require('http-errors');

const {
  TaxonomyDimensions,
  TaxonomyItems,
} = require('../../common/models.common.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const {
  StandardDimensions,
  DIMENSION_NAME_PATTERN,
  TaxonomyLimits,
} = require('../../constant/taxonomy-type.js');
const { compareDimensions } = require('../../../shared/taxonomy/sort.js');
const { buildStandardDimensions } = require('./default-dimensions.js');
const { resolveExistingCompanyId, scopedById } = require('./company-scope.js');
const {
  isObjectId,
  validateDimensionPayload,
  readDimensionName,
  limitReached,
} = require('./taxonomy.validation.js');
const logger = require('../../utils/logger.js');

module.exports = {
  listDimensions,
  createDimension,
  updateDimension,
  deleteDimension,
  assertValueType,
};

/**
 * The company's dimensions, the two standard ones first seeded if missing.
 *
 * Seeded on read rather than at company creation: companies already exist, and
 * the first read of the taxonomy screen is when the rows become useful. Every
 * missing standard dimension is seeded, not only on an empty list, so a company
 * that declared a dimension before ever listing still gets both.
 *
 * @param {Object} params
 * @param {Object} params.user
 * @param {string} [params.groupId] company to read, super admin only: a 404
 *   when no company has this id, rather than seeding dimensions for it
 * @param {string} [params.lang] the admin's language, for the seeded wording
 * @returns {Promise<Object[]>} in display order
 */
async function listDimensions({ user, groupId, lang }) {
  logger.log('dimensionService:listDimensions');

  const companyId = await resolveExistingCompanyId(user, groupId);
  await seedStandardDimensions({ companyId, lang: lang || user?.lang });

  // Sorted by the comparator the screen and the editor use, so the three
  // agree on the order. A company has 20 dimensions at most.
  const dimensions = await TaxonomyDimensions.find({
    _company: companyId,
  }).lean();
  return dimensions.sort(compareDimensions);
}

/**
 * Declare a dimension of the company. Its name is what templates read, and it
 * is write-once (ADR-0015).
 *
 * A name that differs from one the company already has only by its case
 * (`Market` next to `market`) is almost always a typo, and a lasting one: the
 * editor would show two lists, and a template reads one exact name. It is
 * refused until the request confirms it with `confirmCaseVariant: true`.
 */
async function createDimension({ user, groupId, payload = {} }) {
  logger.log('dimensionService:createDimension');

  const companyId = await resolveExistingCompanyId(user, groupId);
  const { name: rawName, confirmCaseVariant = false, ...rest } = payload;
  const name = readDimensionName(rawName);
  if (typeof confirmCaseVariant !== 'boolean') {
    throw new BadRequest(ERROR_CODES.INVALID_DIMENSION);
  }
  const fields = validateDimensionPayload(rest, { partial: false });

  // Seeded first, so a company declaring `trigger` before ever listing its
  // dimensions meets the standard one rather than shadowing it.
  await seedStandardDimensions({ companyId, lang: user?.lang });

  // Deactivated dimensions included: they still hold a name and a place on
  // the screen.
  const existingNames = (
    await TaxonomyDimensions.find({ _company: companyId })
      .select({ name: 1 })
      .lean()
  ).map((dimension) => dimension.name);

  if (existingNames.includes(name)) {
    throw new Conflict(ERROR_CODES.DIMENSION_NAME_ALREADY_EXISTS);
  }
  // The standard dimensions count. Not atomic with the insert, like the cap
  // on values: a race lands one dimension past it, which bounds the screen
  // just as well.
  if (existingNames.length >= TaxonomyLimits.DIMENSIONS_PER_COMPANY) {
    throw limitReached(TaxonomyLimits.DIMENSIONS_PER_COMPANY);
  }
  const caseVariant = existingNames.find(
    (existing) => existing.toLowerCase() === name.toLowerCase()
  );
  if (caseVariant && !confirmCaseVariant) {
    const error = new Conflict(ERROR_CODES.DIMENSION_NAME_DIFFERS_ONLY_BY_CASE);
    // Named, so the admin compares the two before confirming.
    error.details = { existingName: caseVariant };
    throw error;
  }

  try {
    return await TaxonomyDimensions.create({
      ...fields,
      name,
      _company: companyId,
      standard: false,
    });
  } catch (error) {
    // The unique index holds the name, deactivated dimensions included.
    if (error?.code === 11000) {
      throw new Conflict(ERROR_CODES.DIMENSION_NAME_ALREADY_EXISTS);
    }
    throw error;
  }
}

/**
 * Edit a dimension: everything but its name. A standard dimension keeps its
 * wording, order and precedence editable, and cannot be deactivated.
 */
async function updateDimension({ user, dimensionId, payload = {} }) {
  logger.log('dimensionService:updateDimension');

  if (payload.name !== undefined) {
    throw new BadRequest(ERROR_CODES.DIMENSION_NAME_IS_FINAL);
  }
  const fields = validateDimensionPayload(payload, { partial: true });
  const dimension = await findScopedDimension({ user, dimensionId });

  if (dimension.standard && fields.isActive === false) {
    throw new Conflict(ERROR_CODES.STANDARD_DIMENSION_LOCKED);
  }

  Object.assign(dimension, fields);
  await dimension.save();
  return dimension;
}

/**
 * Delete a dimension while it has no values. Once it has some, it is
 * deactivated instead: deleting it would leave its values, and the emails
 * carrying them, under a name nothing declares.
 *
 * Deactivated first, then counted, then deleted. An inactive dimension takes no
 * new value (assertValueType), so a value created while this runs is either in
 * the count or refused. Counting first would let one created between the count
 * and the delete stay behind, and come back if the name were declared again.
 */
async function deleteDimension({ user, dimensionId }) {
  logger.log('dimensionService:deleteDimension');

  const dimension = await findScopedDimension({ user, dimensionId });

  if (dimension.standard) {
    throw new Conflict(ERROR_CODES.STANDARD_DIMENSION_LOCKED);
  }

  const scope = { _id: dimension._id, _company: dimension._company };
  await TaxonomyDimensions.updateOne(scope, { $set: { isActive: false } });

  const valueCount = await TaxonomyItems.countDocuments({
    _company: dimension._company,
    type: dimension.name,
  });
  if (valueCount > 0) {
    // Refused: the dimension goes back to the state the admin left it in.
    if (dimension.isActive) {
      await TaxonomyDimensions.updateOne(scope, { $set: { isActive: true } });
    }
    const error = new Conflict(ERROR_CODES.DIMENSION_HAS_VALUES);
    error.details = { valueCount };
    throw error;
  }

  await TaxonomyDimensions.deleteOne(scope);
}

/**
 * Check that a value may belong to the dimension `type` in this company.
 *
 * The email type is always there, so it is accepted without a read. The
 * trigger never takes a value: its two are the doctrine's. Any other name must
 * be a dimension the company declared, and an active one to receive a new value.
 *
 * @param {Object} params
 * @param {ObjectId} params.companyId
 * @param {*} params.type
 * @param {boolean} [params.toWrite] a value is about to be created under it
 * @returns {Promise<string>} the type
 */
async function assertValueType({ companyId, type, toWrite = false }) {
  const invalid = () => new BadRequest(ERROR_CODES.INVALID_TAXONOMY_TYPE);

  if (typeof type !== 'string' || !DIMENSION_NAME_PATTERN.test(type)) {
    throw invalid();
  }
  if (type === StandardDimensions.EMAIL_TYPE) return type;
  if (type === StandardDimensions.TRIGGER) throw invalid();

  const dimension = await TaxonomyDimensions.findOne({
    _company: companyId,
    name: type,
  }).lean();
  if (!dimension || (toWrite && !dimension.isActive)) {
    throw invalid();
  }

  return type;
}

async function findScopedDimension({ user, dimensionId }) {
  if (!dimensionId || !isObjectId(dimensionId)) {
    throw new NotFound(ERROR_CODES.DIMENSION_NOT_FOUND);
  }

  const dimension = await TaxonomyDimensions.findOne(
    scopedById(user, dimensionId)
  );
  if (!dimension) {
    throw new NotFound(ERROR_CODES.DIMENSION_NOT_FOUND);
  }

  return dimension;
}

async function seedStandardDimensions({ companyId, lang }) {
  const existing = await TaxonomyDimensions.find({
    _company: companyId,
    standard: true,
  })
    .select({ name: 1 })
    .lean();
  const seeded = new Set(existing.map((dimension) => dimension.name));
  const missing = buildStandardDimensions(lang).filter(
    (dimension) => !seeded.has(dimension.name)
  );
  if (missing.length === 0) return;

  try {
    await TaxonomyDimensions.insertMany(
      missing.map((dimension) => ({ ...dimension, _company: companyId })),
      { ordered: false }
    );
  } catch (error) {
    // Two admins opening the screen at once both seed; the unique index keeps
    // one row per name, and the rows it refuses are the ones the other call
    // inserted. Anything else is a seed that did not take, and must be heard.
    const isDuplicate =
      error?.code === 11000 ||
      (Array.isArray(error?.writeErrors) &&
        error.writeErrors.every((writeError) => writeError.code === 11000));
    if (!isDuplicate) throw error;
  }
}
