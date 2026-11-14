'use strict';

const {
  TaxonomyItems,
  TaxonomyDimensions,
} = require('../common/models.common.js');
const {
  STANDARD_DIMENSIONS,
} = require('../taxonomy/services/default-dimensions.js');
const { TaxonomyTypes } = require('../constant/taxonomy-type.js');
const { EmailTriggerValues } = require('../constant/email-trigger.js');
const {
  buildEditorDimensions,
} = require('./mailing-company-dimensions.service.js');
const logger = require('../utils/logger.js');

module.exports = { buildEditorMetadata };

const DEFAULT_EMAIL_TYPE_PRECEDENCE = STANDARD_DIMENSIONS.find(
  (dimension) => dimension.name === TaxonomyTypes.EMAIL_TYPE
).precedence;

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
  // Populated, an id, or the id as a string.
  const mailingCompanyId =
    (mailing._company &&
      (mailing._company._id || mailing._company.id || mailing._company)) ||
    null;
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
  // it against (see validateEmailType in
  // mailing-metadata.service.js). Offering the template company's
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
        .select({
          label: 1,
          canonicalType: 1,
          order: 1,
          description: 1,
          tokens: 1,
        })
        .sort({ order: 1, label: 1 })
        .lean()
    : [];
  // Same reason as the typologies: no company, no value the save could accept.
  const dimensions = mailingCompanyId
    ? await buildEditorDimensions({
        companyId: mailingCompanyId,
        currentIds: mailing._taxonomyItems,
        templateId: mailing._wireframe?._id || mailing._wireframe,
      })
    : [];

  const emailTypeDimension = mailingCompanyId
    ? await TaxonomyDimensions.findOne({
        _company: mailingCompanyId,
        name: TaxonomyTypes.EMAIL_TYPE,
      })
        .select({ precedence: 1 })
        .lean()
    : null;
  // Unseeded, it has the default of the standard dimension (default-dimensions.js).
  const emailTypePrecedence = emailTypeDimension
    ? emailTypeDimension.precedence || 0
    : DEFAULT_EMAIL_TYPE_PRECEDENCE;

  return {
    emailMetadata: {
      subject: mailing.subject,
      plannedSendDate: mailing.plannedSendDate,
      emailTypeId: mailing._emailType,
      trigger: mailing.trigger,
      taxonomyItemIds: mailing._taxonomyItems || [],
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
        tokens: item.tokens || {},
      })),
      // The email type's precedence, for the design tokens its values carry.
      emailTypePrecedence,
      // The two values the trigger select offers. Sent rather than hard-coded in
      // the editor so the doctrine's vocabulary has one source; the editor
      // translates them from its own locale files.
      triggers: [...EmailTriggerValues],
      // The company dimensions, each a select after the trigger. A deactivated
      // one is absent, but the values the email carries under it stay in
      // `taxonomyItemIds`, and the editor sends them back untouched.
      dimensions,
      url: { update: `/api/mailings/${mailingId}/metadata` },
    },
  };
}
