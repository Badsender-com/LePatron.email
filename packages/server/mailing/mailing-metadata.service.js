'use strict';

const mongoose = require('mongoose');
const { BadRequest, NotFound, Forbidden } = require('http-errors');

const { TaxonomyItems } = require('../common/models.common.js');
const ERROR_CODES = require('../constant/error-codes.js');
const { TaxonomyTypes } = require('../constant/taxonomy-type.js');
const modelsUtils = require('../utils/model.js');
const { writePreheader } = require('./preheader-resolver.js');

/**
 * Keys accepted by both `PATCH /mailings/:id/metadata` and `POST /mailings`.
 * `preheader` is accepted by the PATCH only — at creation time the mailing has no
 * `data` yet, so there is nowhere to write it.
 */
const METADATA_KEYS = Object.freeze([
  'subject',
  'plannedSendDate',
  '_emailType',
]);

module.exports = {
  validateMetadataPayload,
  applyMetadataToMailing,
  METADATA_KEYS,
};

const isDefined = (value) => value !== undefined;

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
    if (payload.subject === null) {
      validated.subject = undefined;
    } else if (typeof payload.subject !== 'string') {
      throw new BadRequest(ERROR_CODES.INVALID_EMAIL_METADATA);
    } else {
      // A single subject per email: A/B variants are out of scope for this phase.
      validated.subject = modelsUtils.trimString(payload.subject);
    }
  }

  if (isDefined(payload.plannedSendDate)) {
    if (payload.plannedSendDate === null || payload.plannedSendDate === '') {
      validated.plannedSendDate = undefined;
    } else {
      const date = new Date(payload.plannedSendDate);
      if (Number.isNaN(date.getTime())) {
        throw new BadRequest(ERROR_CODES.INVALID_EMAIL_METADATA);
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
    throw new BadRequest(ERROR_CODES.INVALID_EMAIL_METADATA);
  }

  // A mailing created by a super admin carries no company (see
  // mailing.service.js#createInsideWorkspaceOrFolder). There is then no company
  // to check the typology against, so we refuse rather than store a reference
  // nobody can validate.
  if (!companyId) {
    throw new Forbidden(ERROR_CODES.EMAIL_TYPE_WRONG_COMPANY);
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

  METADATA_KEYS.forEach((key) => {
    if (key in validated) {
      mailing[key] = validated[key];
    }
  });

  let preheaderWritten = false;

  if (isDefined(payload.preheader)) {
    if (payload.preheader !== null && typeof payload.preheader !== 'string') {
      throw new BadRequest(ERROR_CODES.INVALID_EMAIL_METADATA);
    }
    const result = writePreheader(mailing.data || {}, payload.preheader || '');
    preheaderWritten = result.written;
    if (preheaderWritten) {
      // http://mongoosejs.com/docs/schematypes.html#mixed
      mailing.markModified('data');
    }
  }

  return { preheaderWritten };
}
