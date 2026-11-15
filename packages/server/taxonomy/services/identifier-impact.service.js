'use strict';

const { Conflict } = require('http-errors');

const { Mailings, Templates } = require('../../common/models.common.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const { StandardDimensions } = require('../../constant/taxonomy-type.js');
const {
  contractOfTemplate,
} = require('../../template/template-contract.service.js');
const {
  comparisonsOf,
} = require('../../../shared/taxonomy/compared-literals.js');

/**
 * Changing the identifier of a value emails carry (ADR-0026). The identifier
 * is what a template compares (`market eq 'be'`), so the change is shown with
 * its impact first, and applied only once confirmed. Nothing is rewritten in
 * bulk: an email keeps the value, and its content takes the new identifier
 * the next time it is opened in the editor.
 */
module.exports = { impactOf, assertChangeConfirmed };

// An email carries an email type in its own field, any other value in its list.
const carriersOf = (item) =>
  item.type === StandardDimensions.EMAIL_TYPE
    ? { _company: item._company, _emailType: item._id }
    : { _company: item._company, _taxonomyItems: item._id };

/**
 * @param {Object} item the value, scoped to the user's company already
 * @returns {Promise<{emails: number, templates: Array<{id: string, name: string, comparisons: number}>}>}
 *   the emails carrying it, and the company's templates comparing its current
 *   identifier for its dimension, the most comparisons first
 */
async function impactOf(item) {
  const [emails, templates] = await Promise.all([
    Mailings.countDocuments(carriersOf(item)),
    Templates.find({ _company: item._company }).select({ name: 1 }).lean(),
  ]);
  const comparing = await Promise.all(
    templates.map(async (template) => {
      const contract = await contractOfTemplate(template._id);
      const comparisons = comparisonsOf(
        contract,
        item.type,
        item.canonicalType
      );
      return { id: String(template._id), name: template.name, comparisons };
    })
  );
  return {
    emails,
    templates: comparing
      .filter((template) => template.comparisons > 0)
      .sort(
        (a, b) =>
          b.comparisons - a.comparisons ||
          String(a.name).localeCompare(String(b.name))
      ),
  };
}

/**
 * Refuse a new identifier for a value emails carry or templates compare,
 * unless the request confirms it after its impact was shown. A value nothing
 * carries yet still breaks the templates comparing its identifier, for the
 * emails to come.
 *
 * @param {Object} item
 * @param {boolean} confirmed
 */
async function assertChangeConfirmed(item, confirmed) {
  if (confirmed === true) return;
  const { emails, templates } = await impactOf(item);
  if (emails > 0 || templates.length > 0) {
    const error = new Conflict(
      ERROR_CODES.TAXONOMY_IDENTIFIER_CHANGE_UNCONFIRMED
    );
    error.details = { emails, templates: templates.length };
    throw error;
  }
}
