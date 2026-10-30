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
} = require('../../constant/taxonomy-type.js');
const { buildStandardDimensions } = require('./default-dimensions.js');
const { resolveCompanyId, scopedById } = require('./company-scope.js');
const {
  isObjectId,
  validateDimensionPayload,
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
 * @param {string} [params.groupId] company to read, super admin only
 * @param {string} [params.lang] the admin's language, for the seeded wording
 * @returns {Promise<Object[]>} in display order
 */
async function listDimensions({ user, groupId, lang }) {
  logger.log('dimensionService:listDimensions');

  const companyId = resolveCompanyId(user, groupId);
  await seedStandardDimensions({ companyId, lang: lang || user?.lang });

  return TaxonomyDimensions.find({ _company: companyId })
    .sort({ order: 1, name: 1 })
    .lean();
}

/**
 * Declare a dimension of the company. Its name is what templates read, and it
 * is write-once (ADR-0015).
 */
async function createDimension({ user, groupId, payload = {} }) {
  logger.log('dimensionService:createDimension');

  const companyId = resolveCompanyId(user, groupId);
  const { name, ...rest } = payload;
  if (typeof name !== 'string' || !DIMENSION_NAME_PATTERN.test(name)) {
    throw new BadRequest(ERROR_CODES.INVALID_DIMENSION);
  }
  const fields = validateDimensionPayload(rest, { partial: false });

  // Seeded first, so a company declaring `trigger` before ever listing its
  // dimensions meets the standard one rather than shadowing it.
  await seedStandardDimensions({ companyId, lang: user?.lang });

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
 */
async function deleteDimension({ user, dimensionId }) {
  logger.log('dimensionService:deleteDimension');

  const dimension = await findScopedDimension({ user, dimensionId });

  if (dimension.standard) {
    throw new Conflict(ERROR_CODES.STANDARD_DIMENSION_LOCKED);
  }

  const valueCount = await TaxonomyItems.countDocuments({
    _company: dimension._company,
    type: dimension.name,
  });
  if (valueCount > 0) {
    const error = new Conflict(ERROR_CODES.DIMENSION_HAS_VALUES);
    error.details = { valueCount };
    throw error;
  }

  await TaxonomyDimensions.deleteOne({
    _id: dimension._id,
    _company: dimension._company,
  });
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
