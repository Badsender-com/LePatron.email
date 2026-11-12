'use strict';

const { BadRequest, Conflict } = require('http-errors');

const { TaxonomyDimensions } = require('../../common/models.common.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const { normaliseCode } = require('../../../shared/locale/locale-codes.js');

/**
 * Dimension roles and normalised codes (ADR-0023). A company dimension may stand
 * for the language, the country or the locale of an email; each of its values
 * then carries a code from that role's standard list, beside its free
 * identifier.
 */
module.exports = { assertRoleIsFree, readNormalisedCode };

/**
 * At most one dimension per role in a company, a deactivated one included: it
 * keeps its role, and would get it back on reactivation.
 *
 * @param {Object} params
 * @param {ObjectId} params.companyId
 * @param {string|null} params.role
 * @param {string} [params.exceptName] the dimension being edited
 */
async function assertRoleIsFree({ companyId, role, exceptName }) {
  if (!role) return;
  const holder = await TaxonomyDimensions.findOne({ _company: companyId, role })
    .select({ name: 1, label: 1 })
    .lean();
  if (holder && holder.name !== exceptName) {
    const error = new Conflict(ERROR_CODES.DIMENSION_ROLE_TAKEN);
    // The label, for the screen to name it in the admin's words.
    error.details = { role, holder: holder.label };
    throw error;
  }
}

/**
 * The code a request gives a value of the dimension `type`, as its role's list
 * writes it. A dimension with no role has no list to check a code against.
 *
 * @param {Object} params
 * @param {ObjectId} params.companyId
 * @param {string} params.type
 * @param {string|null} params.code null clears it
 * @returns {Promise<string|undefined>} undefined clears the stored code
 */
async function readNormalisedCode({ companyId, type, code }) {
  if (code === null) return undefined;
  const invalid = () => new BadRequest(ERROR_CODES.INVALID_TAXONOMY_ITEM);

  const dimension = await TaxonomyDimensions.findOne({
    _company: companyId,
    name: type,
  })
    .select({ role: 1 })
    .lean();
  if (!dimension || !dimension.role) throw invalid();

  const normalised = normaliseCode(dimension.role, code);
  if (!normalised) throw invalid();
  return normalised;
}
