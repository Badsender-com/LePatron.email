'use strict';

/**
 * Updates a previewHtml string by replacing original texts with their translations.
 *
 * Strategy:
 *   Pass 1 – direct string replacement (handles rich text / body content)
 *   Pass 2 – HTML-entity-encoded replacement (handles attribute values: alt, title, etc.)
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
  if (!previewHtml || typeof previewHtml !== 'string') return previewHtml;
  if (!originalTexts || !translations) return previewHtml;

  let html = previewHtml;

  for (const key of Object.keys(translations)) {
    const originalText = originalTexts[key];
    const translatedText = translations[key];

    // Skip if missing or unchanged
    if (!originalText || !translatedText || originalText === translatedText) {
      continue;
    }

    // Pass 1: direct replacement (body text / rich text)
    if (html.includes(originalText)) {
      html = html.split(originalText).join(translatedText);
      // Avoid double-processing: if pass 1 matched, skip pass 2
      continue;
    }

    // Pass 2: HTML-entity-encoded replacement (attribute values)
    const encodedOriginal = encodeHtmlEntities(originalText);
    if (encodedOriginal !== originalText && html.includes(encodedOriginal)) {
      html = html
        .split(encodedOriginal)
        .join(encodeHtmlEntities(translatedText));
    }
  }

  return html;
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
