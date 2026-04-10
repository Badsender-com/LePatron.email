'use strict';

/**
 * Updates a previewHtml string by replacing original texts with their translations.
 *
 * Strategy:
 *   Pass 1 – single-pass regex replacement against all original texts
 *            (handles rich text / body content)
 *   Pass 2 – single-pass regex replacement against HTML-entity-encoded
 *            versions of the texts that weren't replaced in Pass 1
 *            (handles attribute values: alt, title, etc.)
 *
 * Compared to the previous per-key split/join approach, each pass now
 * allocates the HTML only once instead of once per key. For a 250 Ko preview
 * with ~1500 keys this brings the cost from ~400 ms (O(N×H)) down to ~20-40 ms.
 *
 * @param {string} previewHtml - The original rendered HTML
 * @param {Object} originalTexts - Map of key → original text (from mosaico-text-extractor)
 * @param {Object} translations  - Map of key → translated text (from translation provider)
 * @returns {string} Updated HTML with translations applied
 */
function updatePreviewWithTranslations(
  previewHtml,
  originalTexts,
  translations
) {
  if (
    !previewHtml ||
    typeof previewHtml !== 'string' ||
    !originalTexts ||
    !translations
  ) {
    return previewHtml;
  }

  // Build the direct lookup (Pass 1) and the encoded lookup (Pass 2).
  // Preserve "first-seen wins" semantics when two keys share the same
  // original text, matching the previous loop-and-skip behaviour.
  const directLookup = Object.create(null);
  const encodedLookup = Object.create(null);

  for (const key of Object.keys(translations)) {
    const originalText = originalTexts[key];
    const translatedText = translations[key];
    if (!originalText || !translatedText || originalText === translatedText) {
      continue;
    }
    if (!(originalText in directLookup)) {
      directLookup[originalText] = translatedText;
    }
    const encodedOriginal = encodeHtmlEntities(originalText);
    if (
      encodedOriginal !== originalText &&
      !(encodedOriginal in encodedLookup)
    ) {
      encodedLookup[encodedOriginal] = encodeHtmlEntities(translatedText);
    }
  }

  let html = previewHtml;
  html = replaceAllFromLookup(html, directLookup);
  html = replaceAllFromLookup(html, encodedLookup);
  return html;
}

/**
 * Replace every occurrence of any lookup key in the input string with its
 * associated value, in a single regex pass. Keys are sorted by descending
 * length so longer texts are matched before any shorter text that could be
 * a prefix of them.
 */
function replaceAllFromLookup(input, lookup) {
  const keys = Object.keys(lookup);
  if (keys.length === 0) return input;

  keys.sort((a, b) => b.length - a.length);
  const pattern = new RegExp(keys.map(escapeRegExp).join('|'), 'g');
  return input.replace(pattern, (match) => lookup[match]);
}

/**
 * Escape a string so it can be used as a literal inside a RegExp.
 */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Encode the subset of HTML entities that appear in attribute values.
 * @param {string} text
 * @returns {string}
 */
function encodeHtmlEntities(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { updatePreviewWithTranslations };
