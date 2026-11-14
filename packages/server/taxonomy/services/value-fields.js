'use strict';

const { Conflict } = require('http-errors');

const { TaxonomyItems } = require('../../common/models.common.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const { StandardDimensions } = require('../../constant/taxonomy-type.js');
const { validatePayload } = require('./taxonomy.validation.js');
const { readAvailability } = require('./availability.js');
const { readNormalisedCode } = require('./dimension-role.js');

/**
 * What a request may write on a value, and the checks a value's fields must
 * pass before it is stored: the fields the taxonomy value service reads, kept
 * apart so that each rule of a value has one place.
 */
module.exports = { readValueFields, assertLabelIsFree, assertIdentifierIsFree };

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
  // Narrowing an availability leaves the emails using the combination as they
  // are: the server checks it again only when a request changes it (ADR-0014).
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
 * no identifier are as many as needed.
 *
 * The email type is left out: there the field maps a value onto one of the
 * doctrine's six types, and several values map onto the same one.
 */
async function assertIdentifierIsFree({
  companyId,
  type,
  identifier,
  exceptId,
}) {
  if (!identifier || type === StandardDimensions.EMAIL_TYPE) return;

  const query = { _company: companyId, type, canonicalType: identifier };
  if (exceptId) {
    query._id = { $ne: exceptId };
  }

  if (await TaxonomyItems.exists(query)) {
    throw new Conflict(ERROR_CODES.TAXONOMY_ITEM_IDENTIFIER_ALREADY_EXISTS);
  }
}
