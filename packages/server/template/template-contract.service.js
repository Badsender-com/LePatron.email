'use strict';

const { Templates } = require('../common/models.common.js');
const {
  readTemplateContract,
  CONTRACT_READER_VERSION,
} = require('./template-contract.js');

const NO_CONTRACT = Object.freeze({
  declared: {},
  read: [],
  adopt: {},
  compared: [],
});

module.exports = { contractOfTemplate, listContracts };

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

/**
 * The contracts of several templates in one query (ADR-0026), for the taxonomy
 * workspace and the impact of an identifier change. Only a contract stored by
 * an older reader is read again, one markup at a time: right after the reader
 * changes, a company's templates are not all loaded at once.
 *
 * @param {Object} filter which templates, eg. `{ _company }`
 * @returns {Promise<Array<{_id: *, name: string, contract: Object}>>}
 */
async function listContracts(filter) {
  const templates = await Templates.find(filter)
    .select({ name: 1, contract: 1, contractVersion: 1 })
    .lean();
  const listed = [];
  for (const template of templates) {
    const current =
      template.contract && template.contractVersion === CONTRACT_READER_VERSION;
    listed.push({
      _id: template._id,
      name: template.name,
      contract: current ? template.contract : await readAgain(template._id),
    });
  }
  return listed;
}

async function readAgain(templateId) {
  const stored = await Templates.findOne({ _id: templateId })
    .select({ markup: 1 })
    .lean();
  const contract = readTemplateContract(stored && stored.markup);
  await Templates.updateOne(
    // Another request may have read it meanwhile: written once.
    { _id: templateId, contractVersion: { $ne: CONTRACT_READER_VERSION } },
    { $set: { contract, contractVersion: CONTRACT_READER_VERSION } },
    { timestamps: false }
  );
  return contract;
}
