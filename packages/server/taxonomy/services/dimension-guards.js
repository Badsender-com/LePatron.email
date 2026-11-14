'use strict';

const { BadRequest, Conflict } = require('http-errors');

const { TaxonomyDimensions } = require('../../common/models.common.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const {
  DimensionScopes,
  StandardDimensions,
  DIMENSION_NAME_PATTERN,
} = require('../../constant/taxonomy-type.js');
const {
  assertParentName,
  assertNoAvailabilityToMove,
} = require('./availability.js');
const {
  assertRoleIsFree,
  assertCodesKeepTheirMeaning,
} = require('./dimension-role.js');

/**
 * What a dimension may be declared as, changed into, or receive: the guards of
 * the dimension service, kept apart so that the service reads as the steps of a
 * request, and each rule of a dimension has one place.
 */
module.exports = {
  assertDimensionName,
  assertDimensionUpdate,
  assertScopeFits,
  assertValueType,
};

// Published by the application to every template (ADR-0023): a dimension of
// that name would shadow it.
const RESERVED_NAMES = Object.freeze(['locale']);

/**
 * A name a template can read (ADR-0015), and not one the application publishes.
 */
function assertDimensionName(name) {
  if (
    typeof name !== 'string' ||
    !DIMENSION_NAME_PATTERN.test(name) ||
    RESERVED_NAMES.includes(name)
  ) {
    throw new BadRequest(ERROR_CODES.INVALID_DIMENSION);
  }
}

/**
 * Check the fields an update changes on a dimension. A standard dimension keeps
 * its wording, order and precedence editable, and cannot be deactivated, nested
 * or given a role.
 *
 * @param {Object} dimension the stored dimension
 * @param {Object} fields the validated fields of the request
 */
async function assertDimensionUpdate(dimension, fields) {
  if (fields.scope !== undefined || fields.role !== undefined) {
    assertScopeFits({
      standard: dimension.standard,
      role: fields.role !== undefined ? fields.role : dimension.role,
      scope: fields.scope !== undefined ? fields.scope : dimension.scope,
    });
  }
  if (dimension.standard && fields.isActive === false) {
    throw new Conflict(ERROR_CODES.STANDARD_DIMENSION_LOCKED);
  }
  if (fields.parentName !== undefined) {
    // The standard dimensions open the list of selects; neither hangs under
    // anything.
    if (dimension.standard && fields.parentName !== null) {
      throw new BadRequest(ERROR_CODES.INVALID_DIMENSION);
    }
    await assertParentName({
      companyId: dimension._company,
      name: dimension.name,
      parentName: fields.parentName,
    });
    await assertNoAvailabilityToMove(dimension, fields.parentName);
  }

  if (fields.role !== undefined) {
    // The doctrine's dimensions mean what the doctrine says, nothing more.
    if (dimension.standard && fields.role !== null) {
      throw new BadRequest(ERROR_CODES.INVALID_DIMENSION);
    }
    await assertRoleIsFree({
      companyId: dimension._company,
      role: fields.role,
      exceptName: dimension.name,
    });
    await assertCodesKeepTheirMeaning(dimension, fields.role);
  }
}

/**
 * A standard dimension, and one holding a role, are offered on every email
 * (ADR-0024): a translated email must not lose its language because its
 * template does not print it.
 *
 * @param {Object} dimension what the dimension is, or is about to be
 * @param {boolean} [dimension.standard]
 * @param {string} [dimension.role]
 * @param {string} [dimension.scope]
 */
function assertScopeFits({ standard, role, scope }) {
  if (scope !== DimensionScopes.READING_TEMPLATES) return;
  if (standard || role) {
    throw new Conflict(ERROR_CODES.DIMENSION_SCOPE_FIXED);
  }
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
