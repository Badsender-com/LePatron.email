'use strict';

const { BadRequest, Conflict } = require('http-errors');

const { TaxonomyItems } = require('../../common/models.common.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const { StandardDimensions } = require('../../constant/taxonomy-type.js');
const { validatePayload } = require('./taxonomy.validation.js');
const { readAvailability } = require('./availability.js');
const { readNormalisedCode } = require('./dimension-role.js');

const {
  IDENTIFIER_PATTERN,
} = require('../../../shared/taxonomy/identifier.js');

/**
 * What a request may write on a value, and the checks a value's fields must
 * pass before it is stored: the fields the taxonomy value service reads, kept
 * apart so that each rule of a value has one place.
 */
module.exports = {
  readValueFields,
  assertLabelIsFree,
  assertIdentifierIsFree,
};

/**
 * The fields of a request, validated and in their stored form: the
 * availability as `_parents`, the code normalised for the dimension's role.
 *
 * @param {Object} params
 * @param {string} params.companyId
 * @param {string} params.type the dimension the value belongs to
 * @param {Object} params.payload
 * @param {boolean} params.partial an update rather than a creation
 * @returns {Promise<Object>}
 */
async function readValueFields({ companyId, type, payload, partial }) {
  const { parentIds, ...fields } = validatePayload(payload, { partial });
  // The identifier is what a template compares and an adoption source names
  // (`brand_[silo]`), the email type's included (ADR-0030): letters, digits,
  // underscores and hyphens only.
  if (fields.canonicalType && !IDENTIFIER_PATTERN.test(fields.canonicalType)) {
    throw new BadRequest(ERROR_CODES.INVALID_TAXONOMY_ITEM);
  }
  // The doctrine's six types classify emails, not markets or brands.
  const isEmailType = type === StandardDimensions.EMAIL_TYPE;
  if (fields.doctrineType !== undefined && !isEmailType) {
    throw new BadRequest(ERROR_CODES.INVALID_TAXONOMY_ITEM);
  }
  // A new email type says it maps onto none: absent means "never migrated",
  // which the migration would map from its identifier (ADR-0030).
  if (isEmailType && !partial && fields.doctrineType === undefined) {
    fields.doctrineType = null;
  }
  // Narrowing an availability leaves the emails using the combination as they
  // are: the server checks it again only when a request changes it (ADR-0032).
  if (parentIds !== undefined) {
    fields._parents = await readAvailability({ companyId, type, parentIds });
  }
  if (fields.code !== undefined) {
    fields.code = await readNormalisedCode({
      companyId,
      type,
      code: fields.code,
    });
  }
  return fields;
}

/**
 * Two companies may use the same label; one company may not use it twice for the
 * same taxonomy. The unique index enforces this, but a duplicate would surface as
 * an E11000 rather than a usable error, so it is checked here too.
 */
async function assertLabelIsFree({ companyId, type, label, exceptId }) {
  // Case-insensitive: "Newsletter" and "newsletter" in the same curated list are a
  // mistake, not two typologies. Accent differences are NOT caught — that would
  // need a stored normalised field, and it is not the collision people actually
  // make. The unique index stays as the exact-match backstop.
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const query = {
    _company: companyId,
    type,
    label: { $regex: `^${escaped}$`, $options: 'i' },
  };
  if (exceptId) {
    query._id = { $ne: exceptId };
  }

  if (await TaxonomyItems.exists(query)) {
    throw new Conflict(ERROR_CODES.TAXONOMY_ITEM_LABEL_ALREADY_EXISTS);
  }
}

/**
 * One identifier per value within a dimension: a template compares against it,
 * and two values answering to the same one could not be told apart. Values with
 * no identifier are as many as needed. The email type's included: its
 * doctrine type, which several share, is a field of its own (ADR-0030).
 */
async function assertIdentifierIsFree({
  companyId,
  type,
  identifier,
  exceptId,
}) {
  if (!identifier) return;

  const query = { _company: companyId, type, canonicalType: identifier };
  if (exceptId) {
    query._id = { $ne: exceptId };
  }

  if (await TaxonomyItems.exists(query)) {
    throw new Conflict(ERROR_CODES.TAXONOMY_ITEM_IDENTIFIER_ALREADY_EXISTS);
  }
}
