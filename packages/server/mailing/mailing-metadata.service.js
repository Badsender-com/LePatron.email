'use strict';

const mongoose = require('mongoose');
const { UnprocessableEntity, NotFound, Forbidden } = require('http-errors');

const { TaxonomyItems } = require('../common/models.common.js');
const ERROR_CODES = require('../constant/error-codes.js');
const { TaxonomyTypes } = require('../constant/taxonomy-type.js');
const modelsUtils = require('../utils/model.js');

// A subject ends up in an email header; a client has no reason to store more.
const MAX_SUBJECT_LENGTH = 255;

// The whole endpoint contract. A key outside this list is refused rather than
// dropped: `preheader` is the case that matters — a client still sending it would
// otherwise get a 200 and believe it saved something.
const KNOWN_FIELDS = Object.freeze([
  'subject',
  'plannedSendDate',
  '_emailType',
]);

module.exports = {
  validateMetadataPayload,
  applyMetadataToMailing,
  MAX_SUBJECT_LENGTH,
  KNOWN_FIELDS,
};

const isDefined = (value) => value !== undefined;

const invalid = () =>
  new UnprocessableEntity(ERROR_CODES.INVALID_EMAIL_METADATA);

/**
 * Validate the metadata part of a payload and return only the fields it actually
 * carries, so a partial update never clears a field it did not mention.
 *
 * `null` is meaningful and distinct from `undefined`: it clears the field.
 *
 * An unknown key is a 422, like taxonomy.service.js does on the neighbouring
 * service. Two guarantees follow: no caller is silently ignored, and `validated`
 * is built field by field — so nothing from the payload can reach the mailing on
 * its own, not `data`, not `_company`, not a Mongo operator.
 *
 * @param {Object} payload raw body
 * @param {Object} options
 * @param {string|ObjectId|null} options.companyId company the mailing belongs to
 * @returns {Promise<Object>} the validated subset, ready to assign
 */
async function validateMetadataPayload(payload = {}, { companyId } = {}) {
  const validated = {};

  const unknown = Object.keys(payload || {}).filter(
    (key) => !KNOWN_FIELDS.includes(key)
  );
  if (unknown.length > 0) {
    throw invalid();
  }

  if (isDefined(payload.subject)) {
    if (payload.subject !== null && typeof payload.subject !== 'string') {
      throw invalid();
    }
    // A single subject per email: A/B variants are out of scope for this phase.
    const subject = modelsUtils.trimString(payload.subject || '');
    if (subject.length > MAX_SUBJECT_LENGTH) {
      throw invalid();
    }
    // An emptied input arrives as '' and must clear the field, not store a blank.
    validated.subject = subject === '' ? undefined : subject;
  }

  if (isDefined(payload.plannedSendDate)) {
    if (payload.plannedSendDate === null || payload.plannedSendDate === '') {
      validated.plannedSendDate = undefined;
    } else {
      const date = new Date(payload.plannedSendDate);
      if (Number.isNaN(date.getTime())) {
        throw invalid();
      }
      validated.plannedSendDate = date;
    }
  }

  if (isDefined(payload._emailType)) {
    validated._emailType = await validateEmailType(payload._emailType, {
      companyId,
    });
  }

  return validated;
}

/**
 * A typology reference is only trustworthy once we know it belongs to the same
 * company as the mailing and to the right taxonomy.
 *
 * @returns {Promise<ObjectId|undefined>} undefined when the reference is cleared
 */
async function validateEmailType(rawId, { companyId }) {
  if (rawId === null || rawId === '') return undefined;

  if (!mongoose.Types.ObjectId.isValid(rawId)) {
    throw invalid();
  }

  // A mailing created by a super admin carries no company (see
  // mailing.service.js#createInsideWorkspaceOrFolder). There is then no company
  // to check the typology against, so we refuse rather than store a reference
  // nobody can validate.
  if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
    throw new Forbidden(ERROR_CODES.EMAIL_TYPE_COMPANY_MISSING);
  }

  const emailType = await TaxonomyItems.findOne({
    _id: mongoose.Types.ObjectId(rawId),
    _company: mongoose.Types.ObjectId(String(companyId)),
    type: TaxonomyTypes.EMAIL_TYPE,
  });

  // A typology of another company reads as "not found": the caller learns
  // nothing about what exists elsewhere.
  if (!emailType) {
    throw new NotFound(ERROR_CODES.EMAIL_TYPE_NOT_FOUND);
  }

  return emailType._id;
}

/**
 * Assign validated metadata onto a mailing document.
 *
 * The preheader is deliberately absent. It is a template property living in the
 * Mixed `data` field, and wiring it through this endpoint would mean changing how
 * our templates declare it — a product question still to be settled. It stays
 * editable where it always has been: the template's own options in the editor,
 * persisted with the email.
 *
 * `requiredFields` of the company config is likewise NOT enforced here: it is
 * stored and validated in this phase, but making fields mandatory comes later
 * with CRM Governance.
 *
 * @param {Object} mailing a Mailings document
 * @param {Object} payload raw body
 * @returns {Promise<void>}
 */
async function applyMetadataToMailing(mailing, payload = {}) {
  const companyId = mailing._company ? String(mailing._company) : null;
  const validated = await validateMetadataPayload(payload, { companyId });

  // `validated` holds exactly the keys the payload carried, so a field added to
  // the validation applies here without a second list to keep in sync.
  Object.keys(validated).forEach((key) => {
    mailing[key] = validated[key];
  });
}
