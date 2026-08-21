'use strict';

const mongoose = require('mongoose');
const { UnprocessableEntity, NotFound, Forbidden } = require('http-errors');

const { TaxonomyItems } = require('../common/models.common.js');
const ERROR_CODES = require('../constant/error-codes.js');
const { TaxonomyTypes } = require('../constant/taxonomy-type.js');
const modelsUtils = require('../utils/model.js');
const { writePreheader } = require('./preheader-resolver.js');

// Subject and preheader both end up in email headers; a client has no reason to
// store more, and `preheader` lands in the Mixed `data` field where nothing else
// would bound it.
const MAX_SUBJECT_LENGTH = 255;
const MAX_PREHEADER_LENGTH = 255;

module.exports = {
  validateMetadataPayload,
  applyMetadataToMailing,
  MAX_SUBJECT_LENGTH,
  MAX_PREHEADER_LENGTH,
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
 * @param {Object} payload raw body
 * @param {Object} options
 * @param {string|ObjectId|null} options.companyId company the mailing belongs to
 * @returns {Promise<Object>} the validated subset, ready to assign
 */
async function validateMetadataPayload(payload = {}, { companyId } = {}) {
  const validated = {};

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
 * Assign validated metadata onto a mailing document, preheader included.
 *
 * `requiredFields` of the company config is deliberately NOT enforced here: it is
 * stored and validated in this phase, but making fields mandatory comes later
 * with CRM Governance.
 *
 * @param {Object} mailing a Mailings document
 * @param {Object} payload raw body
 * @returns {Promise<{ preheaderWritten: boolean }>}
 */
async function applyMetadataToMailing(mailing, payload = {}) {
  const companyId = mailing._company ? String(mailing._company) : null;
  const validated = await validateMetadataPayload(payload, { companyId });

  // `validated` holds exactly the keys the payload carried, so a field added to
  // the validation applies here without a second list to keep in sync.
  Object.keys(validated).forEach((key) => {
    mailing[key] = validated[key];
  });

  let preheaderWritten = false;

  if (isDefined(payload.preheader)) {
    if (payload.preheader !== null && typeof payload.preheader !== 'string') {
      throw invalid();
    }
    const preheader = payload.preheader || '';
    if (preheader.length > MAX_PREHEADER_LENGTH) {
      throw invalid();
    }
    const result = writePreheader(mailing.data || {}, preheader);
    preheaderWritten = result.written;
    if (preheaderWritten) {
      // http://mongoosejs.com/docs/schematypes.html#mixed
      mailing.markModified('data');
    }
  }

  return { preheaderWritten };
}
