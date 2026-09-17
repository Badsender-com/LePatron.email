'use strict';

const mongoose = require('mongoose');
const { UnprocessableEntity, NotFound, Forbidden } = require('http-errors');

const { TaxonomyItems } = require('../common/models.common.js');
const ERROR_CODES = require('../constant/error-codes.js');
const { TaxonomyTypes } = require('../constant/taxonomy-type.js');
const modelsUtils = require('../utils/model.js');
const logger = require('../utils/logger.js');

// A subject ends up in an email header; a client has no reason to store more.
const MAX_SUBJECT_LENGTH = 255;

// The whole endpoint contract. A key outside this list is refused rather than
// dropped: `preheader` is the case that matters — a client still sending it would
// otherwise get a 200 and believe it saved something.
const KNOWN_FIELDS = Object.freeze([
  'subject',
  'plannedSendDate',
  'emailTypeId',
]);

module.exports = {
  validateMetadataPayload,
  applyMetadataToMailing,
  buildEditorMetadata,
  MAX_SUBJECT_LENGTH,
  KNOWN_FIELDS,
};

const isDefined = (value) => value !== undefined;

/**
 * A planned send date is a calendar day, not an instant: it has no time field in
 * the interface, and it must read back as the same day for every teammate.
 *
 * The editor already sends noon UTC, but it is not the only writer — the creation
 * modal and the listing are coming, and the ESP export will read this back. The
 * invariant belongs here, where every client passes, rather than in each of them.
 *
 * Noon UTC rather than midnight: midnight UTC is the previous day everywhere west
 * of Greenwich, so a range query on `plannedSendDate` would put a send on the
 * wrong side of a day boundary. Noon holds for every offset from -11 to +11.
 */
function toNoonUtc(date) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      12,
      0,
      0,
      0
    )
  );
}

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
      validated.plannedSendDate = toNoonUtc(date);
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
        .select({ label: 1, canonicalType: 1, order: 1 })
        .sort({ order: 1, label: 1 })
        .lean()
    : [];

  return {
    emailMetadata: {
      subject: mailing.subject,
      plannedSendDate: mailing.plannedSendDate,
      emailTypeId: mailing._emailType,
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
      })),
      url: { update: `/api/mailings/${mailingId}/metadata` },
    },
  };
}
