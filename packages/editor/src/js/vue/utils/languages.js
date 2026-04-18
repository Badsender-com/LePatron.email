'use strict';

/**
 * Available languages for translation (aligned with DeepL supported languages)
 * Sorted alphabetically by label
 *
 * Format: { code: 'code', name: 'English Name (Native Name)' }
 * - code: language code (lowercase, with regional variant if applicable)
 * - name: English name with native name in parentheses
 */
const LANGUAGE_OPTIONS = [
  { code: 'ar', name: 'Arabic (العربية)' },
  { code: 'bg', name: 'Bulgarian (Български)' },
  { code: 'zh-hans', name: 'Chinese - Simplified (简体中文)' },
  { code: 'zh-hant', name: 'Chinese - Traditional (繁體中文)' },
  { code: 'cs', name: 'Czech (Čeština)' },
  { code: 'da', name: 'Danish (Dansk)' },
  { code: 'nl', name: 'Dutch (Nederlands)' },
  { code: 'en-gb', name: 'English - UK (British)' },
  { code: 'en-us', name: 'English - US (American)' },
  { code: 'et', name: 'Estonian (Eesti)' },
  { code: 'fi', name: 'Finnish (Suomi)' },
  { code: 'fr', name: 'French (Français)' },
  { code: 'de', name: 'German (Deutsch)' },
  { code: 'el', name: 'Greek (Ελληνικά)' },
  { code: 'hu', name: 'Hungarian (Magyar)' },
  { code: 'id', name: 'Indonesian (Bahasa Indonesia)' },
  { code: 'it', name: 'Italian (Italiano)' },
  { code: 'ja', name: 'Japanese (日本語)' },
  { code: 'ko', name: 'Korean (한국어)' },
  { code: 'lv', name: 'Latvian (Latviešu)' },
  { code: 'lt', name: 'Lithuanian (Lietuvių)' },
  { code: 'nb', name: 'Norwegian (Norsk Bokmål)' },
  { code: 'pl', name: 'Polish (Polski)' },
  { code: 'pt-br', name: 'Portuguese - Brazil (Português Brasil)' },
  { code: 'pt-pt', name: 'Portuguese - Portugal (Português)' },
  { code: 'ro', name: 'Romanian (Română)' },
  { code: 'ru', name: 'Russian (Русский)' },
  { code: 'sk', name: 'Slovak (Slovenčina)' },
  { code: 'sl', name: 'Slovenian (Slovenščina)' },
  { code: 'es', name: 'Spanish (Español)' },
  { code: 'sv', name: 'Swedish (Svenska)' },
  { code: 'tr', name: 'Turkish (Türkçe)' },
  { code: 'uk', name: 'Ukrainian (Українська)' },
];

/**
 * Map of language codes to their labels
 * Generated from LANGUAGE_OPTIONS for quick lookup
 */
const LANGUAGE_LABELS = LANGUAGE_OPTIONS.reduce((acc, lang) => {
  acc[lang.code] = lang.name;
  return acc;
}, {});

/**
 * Get language label by code
 * @param {string} code - Language code
 * @returns {string} Language label or uppercase code if not found
 */
function getLanguageLabel(code) {
  return LANGUAGE_LABELS[code] || code.toUpperCase();
}

module.exports = {
  LANGUAGE_OPTIONS,
  LANGUAGE_LABELS,
  getLanguageLabel,
};
