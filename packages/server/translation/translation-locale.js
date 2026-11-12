'use strict';

const {
  TaxonomyDimensions,
  TaxonomyItems,
} = require('../common/models.common.js');
const {
  resolveEmailLocale,
} = require('../taxonomy/services/email-locale.service.js');
const { joinLocale } = require('../../shared/locale/locale-codes.js');

const NOT_FOUND = 'TRANSLATION_LANGUAGE_VALUE_NOT_FOUND';
const AMBIGUOUS = 'TRANSLATION_LANGUAGE_VALUE_AMBIGUOUS';

/**
 * What the email's locale changes in the AI translation (ADR-0023): the source
 * language it starts from, and the language value the translated copy carries.
 */
module.exports = {
  sourceLanguageFor,
  detectSourceLanguage,
  copyLanguageValues,
  NOT_FOUND,
  AMBIGUOUS,
};

/**
 * The language a translation starts from: the one the user chose, otherwise
 * the email's own, otherwise a guess from the markup as before.
 *
 * @param {Object} params
 * @param {Object} params.mailing
 * @param {string} [params.requested] the user's choice, `auto` for none
 * @param {Function} [params.detect] the fallback guess, from the mailing
 * @returns {Promise<string>} a language code, or `auto`
 */
async function sourceLanguageFor({
  mailing,
  requested,
  detect = detectSourceLanguage,
}) {
  if (requested && requested !== 'auto') return requested;
  // An email with no value has no language to read: no lookup.
  if ((mailing._taxonomyItems || []).length > 0) {
    const { language } = await resolveEmailLocale({ mailing });
    // ISO 639-1, the code the providers take as a source.
    if (language) return language;
  }
  return detect(mailing);
}

/**
 * Guess the source language from the `lang` of the email's preview.
 *
 * @param {Object} mailing
 * @returns {string} a two-letter code, or `auto`
 */
function detectSourceLanguage(mailing) {
  if (mailing.previewHtml) {
    const langMatch = mailing.previewHtml.match(
      /<html[^>]*\slang=["']([a-z]{2})["']/i
    );
    if (langMatch) {
      return langMatch[1].toLowerCase();
    }
  }
  return 'auto';
}

/**
 * The values a copy translated into `targetLanguage` carries: those of the
 * source, with the value of the dimension holding the language role, or the
 * locale role, replaced by the one matching the target. Never the market: a
 * translation does not move an email.
 *
 * - language role: the active value coded with the target's language (`en`
 *   for `en-gb`), offered under the email's parent value when the dimension is
 *   nested;
 * - locale role: the active value coded with the target's language and the
 *   email's current country.
 *
 * With no such value, or several, the copy carries none of that dimension: a
 * guess would classify it wrongly without a word, so the caller says it.
 *
 * @param {Object} params
 * @param {Object} params.mailing the source, untouched
 * @param {string} params.targetLanguage a translation code, `nl`, `en-gb`
 * @returns {Promise<{taxonomyItemIds: Array, warning: (string|null)}>}
 */
async function copyLanguageValues({ mailing, targetLanguage }) {
  const ids = [...(mailing._taxonomyItems || [])];
  const companyId = mailing._company?._id || mailing._company;
  if (!companyId) return { taxonomyItemIds: ids, warning: null };

  const dimensions = await TaxonomyDimensions.find({
    _company: companyId,
    isActive: true,
  })
    .select({ name: 1, role: 1, parentName: 1 })
    .lean();
  const targets = dimensions.filter(
    (dimension) => dimension.role === 'language' || dimension.role === 'locale'
  );
  if (targets.length === 0) return { taxonomyItemIds: ids, warning: null };

  const language = String(targetLanguage).split('-')[0].toLowerCase();
  const { country } = await resolveEmailLocale({ mailing });
  const carried = await TaxonomyItems.find({
    _id: { $in: ids },
    _company: companyId,
  })
    .select({ type: 1 })
    .lean();
  const carriedOf = (name) =>
    name === 'emailType'
      ? mailing._emailType
      : carried.find((item) => item.type === name)?._id;
  const activeNames = new Set(dimensions.map((dimension) => dimension.name));

  let taxonomyItemIds = ids;
  let warning = null;
  for (const dimension of targets) {
    const code =
      dimension.role === 'locale'
        ? joinLocale({ language, country })
        : language;
    const parentValue =
      dimension.parentName &&
      (activeNames.has(dimension.parentName) ||
        dimension.parentName === 'emailType')
        ? carriedOf(dimension.parentName) || null
        : undefined;
    const candidates = await offered({
      companyId,
      dimension,
      code,
      parentValue,
    });

    const replaced = new Set(
      carried
        .filter((item) => item.type === dimension.name)
        .map((item) => String(item._id))
    );
    taxonomyItemIds = taxonomyItemIds.filter((id) => !replaced.has(String(id)));
    if (candidates.length === 1) {
      taxonomyItemIds = [...taxonomyItemIds, candidates[0]._id];
    } else {
      warning = warning || (candidates.length === 0 ? NOT_FOUND : AMBIGUOUS);
    }
  }

  return { taxonomyItemIds, warning };
}

// The active values of `dimension` coded `code`, and offered under
// `parentValue` when it is nested (undefined: not nested, null: no parent value,
// so nothing is offered).
async function offered({ companyId, dimension, code, parentValue }) {
  if (!code || parentValue === null) return [];
  const values = await TaxonomyItems.find({
    _company: companyId,
    type: dimension.name,
    code,
    isActive: true,
  })
    .select({ _parents: 1 })
    .lean();
  if (parentValue === undefined) return values;
  return values.filter((value) => {
    const parents = (value._parents || []).map(String);
    return parents.length === 0 || parents.includes(String(parentValue));
  });
}
