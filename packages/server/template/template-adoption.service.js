'use strict';

const { NotFound } = require('http-errors');

const { Templates, Mailings } = require('../common/models.common.js');
const ERROR_CODES = require('../constant/error-codes.js');
const { StandardDimensions } = require('../constant/taxonomy-type.js');
const {
  buildEditorDimensions,
} = require('../mailing/mailing-company-dimensions.service.js');
const { contractOfTemplate } = require('./template-contract.service.js');
const { adoptValues } = require('../../shared/taxonomy/adoption.js');

/**
 * The adoption of a template's emails in bulk (ADR-0024): for every email of
 * the template, what the rule the editor applies when an email opens would set
 * from its content (shared/taxonomy/adoption.js), and what it cannot.
 *
 * Adoption only: no default is applied, a default being for an email created
 * or a parent changed. Only the email's taxonomy values would be written,
 * on its empty dimensions, never its content.
 */
module.exports = { adoptForTemplate };

/**
 * @param {Object} params
 * @param {string} params.templateId
 * @param {boolean} params.apply false previews, and writes nothing; true
 *   attaches each email to the values adopted, its content untouched
 * @returns {Promise<{emails: Array, counts: Object}>} per email its `id`,
 *   `name`, the identifiers it would take (`adopted`, dimension → identifier)
 *   and its `gaps`. Counted as `attached` when it takes values and has no gap,
 *   `withGaps` when it has one, `complete` when nothing is left to adopt.
 */
async function adoptForTemplate({ templateId, apply }) {
  const template = await Templates.findOne({ _id: templateId })
    .select({ _company: 1 })
    .lean();
  if (!template) throw new NotFound(ERROR_CODES.TEMPLATE_NOT_FOUND);

  const companyId = template._company;
  const dimensions = await buildEditorDimensions({ companyId, templateId });
  const contract = await contractOfTemplate(templateId);
  const mailings = await Mailings.find({
    _company: companyId,
    _wireframe: templateId,
  })
    .select({ name: 1, data: 1, _taxonomyItems: 1, _emailType: 1 })
    .lean();

  const emails = mailings
    .map((mailing) => entryFor(mailing, dimensions, contract))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  if (apply) await attach(mailings, emails);
  return { emails, counts: countsOf(emails) };
}

/**
 * Write the adopted values beside the ones each email carries: its empty
 * dimensions only, never its content nor its rendered HTML, which stays the
 * one it was saved with until the email is opened again.
 *
 * Written only while the email carries what was read: one saved in between
 * is left as its author saved it, and taken up by the next run.
 */
async function attach(mailings, emails) {
  const byId = new Map(
    mailings.map((mailing) => [String(mailing._id), mailing])
  );
  // As when an email opens: what could be adopted is, beside its gaps.
  const toAttach = emails.filter((entry) => entry.adoptedIds.length > 0);
  // One email at a time: a few hundred at most, and each its own condition.
  for (const entry of toAttach) {
    const carried = byId.get(entry.id)._taxonomyItems || [];
    await Mailings.updateOne(
      { _id: entry.id, _taxonomyItems: unchanged(carried) },
      { $set: { _taxonomyItems: [...carried, ...entry.adoptedIds] } },
      // Attaching values is not an edit of the email.
      { timestamps: false }
    );
  }
}

function entryFor(mailing, dimensions, contract) {
  const { selections, adopted, gaps } = adoptValues({
    dimensions,
    contract,
    content: mailing.data || {},
    selections: carriedSelections(mailing, dimensions),
  });
  const identifierOf = (name) =>
    dimensions
      .find((dimension) => dimension.name === name)
      .values.find((value) => String(value.id) === String(selections[name]))
      .canonicalType;

  return {
    id: String(mailing._id),
    name: mailing.name,
    adopted: Object.fromEntries(
      adopted.map((name) => [name, identifierOf(name)])
    ),
    adoptedIds: adopted.map((name) => selections[name]),
    gaps,
  };
}

// What the email carries: one value per dimension, and its email type, the
// parent of a dimension hung under it.
function carriedSelections(mailing, dimensions) {
  const carried = new Set((mailing._taxonomyItems || []).map(String));
  const selections = mailing._emailType
    ? { [StandardDimensions.EMAIL_TYPE]: String(mailing._emailType) }
    : {};
  dimensions.forEach((dimension) => {
    const value = dimension.values.find((candidate) =>
      carried.has(String(candidate.id))
    );
    if (value) selections[dimension.name] = value.id;
  });
  return selections;
}

// The list as it was read. An email made before the taxonomy has none at all,
// which an empty array does not match.
function unchanged(carried) {
  return carried.length > 0 ? carried : { $in: [null, []] };
}

function countsOf(emails) {
  return emails.reduce(
    (counts, entry) => {
      if (entry.gaps.length > 0) counts.withGaps += 1;
      else if (entry.adoptedIds.length > 0) counts.attached += 1;
      else counts.complete += 1;
      return counts;
    },
    { attached: 0, withGaps: 0, complete: 0 }
  );
}
