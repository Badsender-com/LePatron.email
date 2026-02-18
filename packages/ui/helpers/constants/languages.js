'use strict';

/**
 * Available languages for translation (aligned with DeepL supported languages)
 * Sorted alphabetically by label
 *
 * Format: { value: 'code', text: 'English Name (Native Name)' }
 * - value: language code (lowercase, with regional variant if applicable)
 * - text: English name with native name in parentheses
 */
export const LANGUAGE_OPTIONS = [
  { value: 'ar', text: 'Arabic (العربية)' },
  { value: 'bg', text: 'Bulgarian (Български)' },
  { value: 'zh-hans', text: 'Chinese - Simplified (简体中文)' },
  { value: 'zh-hant', text: 'Chinese - Traditional (繁體中文)' },
  { value: 'cs', text: 'Czech (Čeština)' },
  { value: 'da', text: 'Danish (Dansk)' },
  { value: 'nl', text: 'Dutch (Nederlands)' },
  { value: 'en-gb', text: 'English - UK (British)' },
  { value: 'en-us', text: 'English - US (American)' },
  { value: 'et', text: 'Estonian (Eesti)' },
  { value: 'fi', text: 'Finnish (Suomi)' },
  { value: 'fr', text: 'French (Français)' },
  { value: 'de', text: 'German (Deutsch)' },
  { value: 'el', text: 'Greek (Ελληνικά)' },
  { value: 'hu', text: 'Hungarian (Magyar)' },
  { value: 'id', text: 'Indonesian (Bahasa Indonesia)' },
  { value: 'it', text: 'Italian (Italiano)' },
  { value: 'ja', text: 'Japanese (日本語)' },
  { value: 'ko', text: 'Korean (한국어)' },
  { value: 'lv', text: 'Latvian (Latviešu)' },
  { value: 'lt', text: 'Lithuanian (Lietuvių)' },
  { value: 'nb', text: 'Norwegian (Norsk Bokmål)' },
  { value: 'pl', text: 'Polish (Polski)' },
  { value: 'pt-br', text: 'Portuguese - Brazil (Português Brasil)' },
  { value: 'pt-pt', text: 'Portuguese - Portugal (Português)' },
  { value: 'ro', text: 'Romanian (Română)' },
  { value: 'ru', text: 'Russian (Русский)' },
  { value: 'sk', text: 'Slovak (Slovenčina)' },
  { value: 'sl', text: 'Slovenian (Slovenščina)' },
  { value: 'es', text: 'Spanish (Español)' },
  { value: 'sv', text: 'Swedish (Svenska)' },
  { value: 'tr', text: 'Turkish (Türkçe)' },
  { value: 'uk', text: 'Ukrainian (Українська)' },
];

/**
 * Map of language codes to their labels
 * Generated from LANGUAGE_OPTIONS for quick lookup
 */
export const LANGUAGE_LABELS = LANGUAGE_OPTIONS.reduce((acc, lang) => {
  acc[lang.value] = lang.text;
  return acc;
}, {});

/**
 * Get language label by code
 * @param {string} code - Language code
 * @returns {string} Language label or uppercase code if not found
 */
export function getLanguageLabel(code) {
  return LANGUAGE_LABELS[code] || code.toUpperCase();
}
