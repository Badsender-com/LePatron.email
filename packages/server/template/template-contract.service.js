'use strict';

const { Templates } = require('../common/models.common.js');
const { readTemplateContract } = require('./template-contract.js');

const NO_CONTRACT = Object.freeze({ declared: {}, read: [], adopt: {} });

module.exports = { contractOfTemplate };

/**
 * The contract of a template (ADR-0024): stored when the template is saved, and
 * read from the markup the first time it is needed for a template saved before
 * the contract existed. Stored then, so the markup, up to several megabytes, is
 * read once.
 *
 * @param {string|ObjectId} templateId
 * @returns {Promise<{declared: Object, read: string[], adopt: Object}>} an empty
 *   contract for a template that does not exist or has no markup
 */
async function contractOfTemplate(templateId) {
  if (!templateId) return NO_CONTRACT;

  const stored = await Templates.findOne({ _id: templateId })
    .select({ contract: 1 })
    .lean();
  if (!stored) return NO_CONTRACT;
  if (stored.contract) return stored.contract;

  const { markup } = await Templates.findOne({ _id: templateId })
    .select({ markup: 1 })
    .lean();
  const contract = readTemplateContract(markup);
  await Templates.updateOne({ _id: templateId }, { $set: { contract } });
  return contract;
}
