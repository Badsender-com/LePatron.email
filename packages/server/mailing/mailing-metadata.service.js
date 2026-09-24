'use strict';

const mongoose = require('mongoose');
const { UnprocessableEntity, NotFound, Forbidden } = require('http-errors');

const { TaxonomyItems } = require('../common/models.common.js');
const ERROR_CODES = require('../constant/error-codes.js');
const { TaxonomyTypes } = require('../constant/taxonomy-type.js');
const { EmailTriggerValues } = require('../constant/email-trigger.js');
const modelsUtils = require('../utils/model.js');
const logger = require('../utils/logger.js');

// A subject ends up in an email header; a client has no reason to store more.
const MAX_SUBJECT_LENGTH = 255;

/**
 * The exact keys this endpoint honours — the same names it answers with.
 *
 * Anything else is refused rather than ignored: a client sending a key the
 * server does not honour must learn it, not receive a 200 that stored nothing.
 * The preheader is the case this exists for — it was dropped from the metadata
 * (see the note on `applyMetadataToMailing`) and a payload still carrying it is
 * a client that needs fixing, not a payload to silently drop.
 */
const ALLOWED_METADATA_KEYS = Object.freeze([
  'subject',
  'plannedSendDate',
  'emailTypeId',
  'trigger',
]);

// The field is a day, not an instant: it has no time, and what is stored must
// read back as the same day from any timezone. Midnight UTC is the day before
// everywhere west of Greenwich, so days are pinned to noon UTC. Normalised here,
// at the common point of passage, rather than in each client.
const PINNED_HOUR_UTC = 12;

module.exports = {
  validateMetadataPayload,
  applyMetadataToMailing,
  normalizePlannedSendDate,
  buildEditorMetadata,
  MAX_SUBJECT_LENGTH,
  ALLOWED_METADATA_KEYS,
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
  assertNoUnknownKey(payload);

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
      validated.plannedSendDate = normalizePlannedSendDate(
        payload.plannedSendDate
      );
    }
  }

  // Read as `emailTypeId`, stored as `_emailType`. The underscore prefix is
  // reserved for Mongoose references by AGENTS.md; it has no business in a public
  // request body, and the response has always answered `emailTypeId`. Renamed
  // while no external client exists.
  if (isDefined(payload.emailTypeId)) {
    validated._emailType = await validateEmailType(payload.emailTypeId, {
      companyId,
    });
  }

  // The trigger is a closed pair, checked here and not only by the schema enum: a
  // Mongoose enum violation surfaces as a ValidationError at save time, several
  // frames away from the field that caused it and after the other metadata have
  // already been assigned. The caller gets the same 422 as for any other bad
  // value, naming nothing the client did not send.
  if (isDefined(payload.trigger)) {
    if (payload.trigger === null || payload.trigger === '') {
      validated.trigger = undefined;
    } else if (!EmailTriggerValues.includes(payload.trigger)) {
      throw invalid();
    } else {
      validated.trigger = payload.trigger;
    }
  }

  return validated;
}

/**
 * Refuse a payload carrying a key this endpoint does not honour.
 *
 * Ignoring it would answer 200 to a client whose value was never stored — the
 * one outcome a partial-update endpoint must not produce, since the response
 * carries the other fields and therefore looks like a success.
 *
 * @param {Object} payload raw body
 * @throws {UnprocessableEntity}
 */
function assertNoUnknownKey(payload) {
  const unknown = Object.keys(payload).find(
    (key) => !ALLOWED_METADATA_KEYS.includes(key)
  );
  if (unknown) {
    // The offending key is not echoed back: nothing user-supplied travels out
    // through an error message. The list of accepted names is what helps.
    const err = invalid();
    err.details = `unknown field. Allowed: ${ALLOWED_METADATA_KEYS.join(', ')}`;
    throw err;
  }
}

/**
 * Turn a client date into the day it denotes, pinned to noon UTC.
 *
 * A date-only string parses as midnight UTC, which reads back as the previous
 * day everywhere west of Greenwich — the field has no time, so the stored value
 * must survive a timezone change. Noon is the only hour that does, both ways.
 *
 * @param {string|Date} rawDate
 * @returns {Date}
 * @throws {UnprocessableEntity} on an unparseable date
 */
function normalizePlannedSendDate(rawDate) {
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) {
    throw invalid();
  }
  // Read back in UTC: the day the client meant is the UTC day of what it sent,
  // which is what a date-only string and an ISO instant agree on.
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      PINNED_HOUR_UTC
    )
  );
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

/**
 * What the editor needs to render the email-settings section: the VALUES it edits,
 * and the CONFIG it renders from (the company's active typologies, and which
 * fields the company wants mandatory).
 *
 * Lives here rather than in `findOneForMosaico` because none of it is a schema
 * concern: which company a typology list is scoped to, and what to do when the
 * mailing and its template disagree, are decisions of the same feature that owns
 * the write path — and they have to stay consistent with it.
 *
 * Returns `null` when nothing should be exposed. The editor decides the section
 * exists from the PRESENCE of `emailMetadataConfig`, so an opted-out company
 * cannot even see that the feature is there.
 *
 * Scoped on the MAILING's company, not the template's. `findOneForMosaico` reads
 * the template's company for the download options — deliberate, since a mailing
 * created by a super admin has no company of its own — but reusing it here would
 * read the flag and the typology list of whichever company owns the template. The
 * write path validates against `mailing._company`: reading somewhere else than we
 * write means offering typologies the save will refuse, and showing one company's
 * vocabulary inside another company's editor.
 *
 * The preheader is deliberately NOT here: it lives in the template's own `data`,
 * which the editor already receives and holds live. A copy in the metadata would
 * be a second value competing with the one that reaches the sent email.
 *
 * @param {Object} options
 * @param {Object} options.mailing the mailing, with `_company` populated
 * @param {Object} options.group the TEMPLATE's company, already loaded
 * @returns {Promise<{emailMetadata: Object, emailMetadataConfig: Object}|null>}
 */
async function buildEditorMetadata({ mailing, group }) {
  const mailingId = mailing._id;
  const mailingCompanyId =
    (mailing._company && (mailing._company._id || mailing._company.id)) || null;
  const templateCompanyId = group._id;

  // A mailing whose company differs from its template's is an inconsistent state,
  // not a supported one. Rather than pick a side, expose nothing and say so:
  // whichever company we chose would be wrong for the other.
  if (
    mailingCompanyId &&
    String(mailingCompanyId) !== String(templateCompanyId)
  ) {
    logger.warn(
      `[buildEditorMetadata] mailing ${mailingId} belongs to company ${mailingCompanyId} but its template belongs to ${templateCompanyId}; email metadata not exposed`
    );
    return null;
  }

  // Past that guard the two companies are the same one, so `group` — already
  // loaded — IS the mailing's company. No second read.
  const metadataCompany = group;
  if (
    !metadataCompany ||
    !metadataCompany.emailMetadata ||
    metadataCompany.emailMetadata.enabled !== true
  ) {
    return null;
  }

  // A mailing with no company of its own cannot have a typology saved on it: the
  // PATCH refuses it with EMAIL_TYPE_COMPANY_MISSING, having no company to check
  // it against (see validateEmailType above). Offering the template company's
  // typologies here would be a select whose every option fails on save. The
  // subject and the date stay editable.
  const emailTypes = mailingCompanyId
    ? await TaxonomyItems.find({
        _company: mailingCompanyId,
        type: TaxonomyTypes.EMAIL_TYPE,
        isActive: true,
      })
        // `description` is the company's own definition of the typology, seeded
        // with the Badsender one. It travels to the editor so the picker can say
        // what a typology means to someone choosing between six of them, rather
        // than only naming them.
        .select({ label: 1, canonicalType: 1, order: 1, description: 1 })
        .sort({ order: 1, label: 1 })
        .lean()
    : [];

  return {
    emailMetadata: {
      subject: mailing.subject,
      plannedSendDate: mailing.plannedSendDate,
      emailTypeId: mailing._emailType,
      trigger: mailing.trigger,
    },
    emailMetadataConfig: {
      enabled: true,
      requiredFields: metadataCompany.emailMetadata.requiredFields || [],
      // Active items only: a deactivated typology must not be offered, but an
      // email already pointing at one keeps its reference.
      emailTypes: emailTypes.map((item) => ({
        id: item._id,
        label: item.label,
        canonicalType: item.canonicalType,
        description: item.description,
      })),
      // The two values the trigger select offers. Sent rather than hard-coded in
      // the editor so the doctrine's vocabulary has one source; the editor
      // translates them from its own locale files.
      triggers: [...EmailTriggerValues],
      url: { update: `/api/mailings/${mailingId}/metadata` },
    },
  };
}
