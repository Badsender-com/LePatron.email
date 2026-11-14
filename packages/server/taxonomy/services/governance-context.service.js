'use strict';

const {
  TaxonomyDimensions,
  TaxonomyItems,
} = require('../../common/models.common.js');
const {
  DimensionScopes,
  StandardDimensions,
} = require('../../constant/taxonomy-type.js');
const { EmailTriggerDefinitions } = require('../../constant/email-trigger.js');
const { buildStandardDimensions } = require('./default-dimensions.js');
const { pickSeedLang } = require('./default-email-types.js');
const { readEmailLocale } = require('./email-locale.service.js');
const { dimensionsInScope } = require('./dimension-scope.js');
const {
  contractOfTemplate,
} = require('../../template/template-contract.service.js');
const logger = require('../../utils/logger.js');

/**
 * What the governance of one email says, for an AI writing assistant: for each
 * active dimension the email has a value for, what the dimension means and what
 * the value means, in the words the company's admin wrote.
 *
 * Not a prompt: the facts of one email, structured and as text. Assembling a
 * prompt is the calling feature's job. The descriptions are written by the
 * company and read by a model, so they are data, never instructions: a caller
 * puts the text where a prompt puts user input.
 */
module.exports = { buildGovernanceContext, renderGovernanceContext };

const isStandard = (dimension) =>
  dimension.name === StandardDimensions.EMAIL_TYPE ||
  dimension.name === StandardDimensions.TRIGGER;

/**
 * @param {Object} params
 * @param {Object} params.mailing a mailing, with `_company`, `_emailType`,
 *   `trigger` and `_taxonomyItems`
 * @param {string} [params.lang] the reader's language, for the trigger's words
 * @returns {Promise<{dimensions: Object[], missing: string[], language:
 *   (string|null), locale: (string|null), text: string}>}
 *   `dimensions` is what the email says, standard dimensions first then in the
 *   declared order; `missing` names the active dimensions the email leaves empty,
 *   so a caller may ask for them rather than write without them.
 */
async function buildGovernanceContext({ mailing, lang }) {
  logger.log('governanceContext:build');

  const companyId = mailing._company?._id || mailing._company;
  const active = await dimensionsInScopeOf(
    mailing,
    companyId,
    await activeDimensions(companyId, lang)
  );
  const values = await valuesOf(mailing, companyId);
  const emailLocale = await readEmailLocale({ mailing });

  const dimensions = [];
  const missing = [];
  active.forEach((dimension) => {
    const value =
      dimension.name === StandardDimensions.TRIGGER
        ? triggerValue(mailing.trigger, lang)
        : values.get(dimension.name);
    if (!value) {
      missing.push(dimension.name);
      return;
    }
    dimensions.push({
      name: dimension.name,
      label: dimension.label,
      description: dimension.description || null,
      value,
    });
  });

  return {
    dimensions,
    missing,
    // The email's language in a normalised form (ADR-0023), whatever the
    // company calls its values: what the AI writes in.
    language: emailLocale.language,
    locale: emailLocale.locale,
    text: renderGovernanceContext({
      dimensions,
      localeLine: localeLine(emailLocale, lang),
    }),
  };
}

/**
 * The same facts as plain text: one section per dimension, a heading an LLM
 * reads as structure, then the two descriptions. Empty when the email carries
 * nothing: a block saying "nothing is defined" would be a statement.
 */
function renderGovernanceContext({ dimensions, localeLine: line = null }) {
  const sections = (dimensions || []).map((dimension) =>
    [
      `### ${dimension.label} : ${dimension.value.label}`,
      dimension.description,
      dimension.value.description,
    ]
      .filter(Boolean)
      .join('\n')
  );
  return [line, ...sections].filter(Boolean).join('\n\n');
}

const LOCALE_LINE = {
  fr: { label: "Langue de l'email", unknown: 'inconnue' },
  en: { label: 'Email language', unknown: 'unknown' },
};

// Said only to a company that declines its emails by a language: to any other,
// an unknown language is no information.
function localeLine({ locale, hasRole }, lang) {
  if (!hasRole) return null;
  const words = LOCALE_LINE[pickSeedLang(lang)];
  return `${words.label}${lang === 'fr' ? ' : ' : ': '}${
    locale || words.unknown
  }`;
}

// The company's active dimensions. A standard one the company never had seeded
// (its taxonomy screen never opened) still counts, in the doctrine's words.
async function activeDimensions(companyId, lang) {
  const stored = await TaxonomyDimensions.find({ _company: companyId })
    .select({
      name: 1,
      label: 1,
      description: 1,
      order: 1,
      isActive: 1,
      scope: 1,
    })
    .lean();
  const storedNames = new Set(stored.map((dimension) => dimension.name));
  const unseeded = buildStandardDimensions(lang).filter(
    (dimension) => !storedNames.has(dimension.name)
  );

  return [
    ...unseeded,
    ...stored.filter((dimension) => dimension.isActive),
  ].sort(
    (a, b) =>
      Number(isStandard(b)) - Number(isStandard(a)) ||
      (a.order || 0) - (b.order || 0) ||
      a.name.localeCompare(b.name)
  );
}

// The dimensions in the scope of the email's template (ADR-0024): one out of it
// is left out like a deactivated one, neither said nor counted as missing.
async function dimensionsInScopeOf(mailing, companyId, dimensions) {
  const restricted = dimensions.filter(
    (dimension) => dimension.scope === DimensionScopes.READING_TEMPLATES
  );
  if (restricted.length === 0) return dimensions;

  const contract = await contractOfTemplate(
    mailing._wireframe?._id || mailing._wireframe
  );
  const values = await TaxonomyItems.find({
    _company: companyId,
    type: { $in: restricted.map((dimension) => dimension.name) },
  })
    .select({ type: 1, tokens: 1 })
    .lean();
  return dimensionsInScope({ dimensions, values, contract });
}

// The values the email carries, by dimension name. Read within the email's
// company only: an id pointing elsewhere reads as no value.
async function valuesOf(mailing, companyId) {
  const ids = [mailing._emailType, ...(mailing._taxonomyItems || [])].filter(
    Boolean
  );
  if (ids.length === 0) return new Map();

  const items = await TaxonomyItems.find({
    _id: { $in: ids },
    _company: companyId,
  })
    .select({ type: 1, label: 1, canonicalType: 1, description: 1 })
    .lean();

  // The email type travels in its own field: a value of that dimension in the
  // list would be a stray, not the email's type.
  const emailTypeId = mailing._emailType && String(mailing._emailType);
  return items.reduce((byName, item) => {
    const isEmailType = item.type === StandardDimensions.EMAIL_TYPE;
    if (isEmailType !== (String(item._id) === emailTypeId)) return byName;
    byName.set(item.type, {
      label: item.label,
      identifier: item.canonicalType || null,
      description: item.description || null,
    });
    return byName;
  }, new Map());
}

function triggerValue(trigger, lang) {
  const definition =
    trigger && EmailTriggerDefinitions[pickSeedLang(lang)][trigger];
  return definition ? { identifier: trigger, ...definition } : null;
}
