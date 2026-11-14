'use strict';

const { Templates } = require('../common/models.common.js');
const {
  readTemplateContract,
  CONTRACT_READER_VERSION,
} = require('./template-contract.js');

const NO_CONTRACT = Object.freeze({ declared: {}, read: [], adopt: {} });

module.exports = { contractOfTemplate };

/**
 * The contract of a template (ADR-0024): stored when the template is saved, and
 * read from the markup the first time it is needed for a template saved before
 * the contract existed. Stored then, so the markup, up to several megabytes, is
 * read once, until the reader changes: a contract stored by an older reader is
 * read again.
 *
 * @param {string|ObjectId} templateId
 * @returns {Promise<{declared: Object, read: string[], adopt: Object}>} an empty
 *   contract for a template that does not exist or has no markup
 */
async function contractOfTemplate(templateId) {
  if (!templateId) return NO_CONTRACT;

  const stored = await Templates.findOne({ _id: templateId })
    .select({ contract: 1, contractVersion: 1 })
    .lean();
  if (!stored) return NO_CONTRACT;
  if (stored.contract && stored.contractVersion === CONTRACT_READER_VERSION) {
    return stored.contract;
  }

  const { markup } = await Templates.findOne({ _id: templateId })
    .select({ markup: 1 })
    .lean();
  const contract = readTemplateContract(markup);
  await Templates.updateOne(
    { _id: templateId },
    { $set: { contract, contractVersion: CONTRACT_READER_VERSION } },
    // Reading the contract again is not an edit of the template.
    { timestamps: false }
  );
  return contract;
}
