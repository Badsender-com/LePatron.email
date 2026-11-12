'use strict';

const {
  resolveEmailLocale,
} = require('../taxonomy/services/email-locale.service.js');

/**
 * What the email's locale changes in the AI translation (ADR-0023): the source
 * language it starts from, and the language value the translated copy carries.
 */
module.exports = { sourceLanguageFor, detectSourceLanguage };

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
