'use strict';

const mailingService = require('../mailing/mailing.service');
const { updatePreviewWithTranslations } = require('./preview-html-updater');
const { sanitizePreviewHtml } = require('../utils/preview-html-sanitizer.js');
const {
  transformDocumentKeepingHtmlCodeBlocks,
} = require('./synthetic-block-protection.js');
const {
  findSyntheticBlocks,
  htmlOf,
} = require('../mailing/synthetic-block-guard.js');
const { injectHeadCss } = require('../../shared/head-css/inject-head-css.js');
const { headCssToExport } = require('../mailing/head-css-guard.js');
const { splitBuilderTranslations } = require('./builder-block-texts.js');
const { swapBuilderMarkup } = require('./builder-preview-swap.js');
const { runTranslationStep } = require('./translation-step.utils.js');
const logger = require('../utils/logger.js');

// The translated copy's previewHtml, derived from the source's.
//
// Not regenerated from the translated data — that takes the editor — but
// edited: generic texts by string replacement, composed blocks by swapping
// their zone, then sanitized. Its own module so the controller only decides
// WHEN this runs, and each step stays a runTranslationStep of its own.

// The markup of every synthetic block, in document order: the exact bytes the
// export put in previewHtml. Each zone is matched exactly on one of them,
// looking a few blocks ahead; a zone whose markup is missing here falls back to
// counting `<div>`, which pasted markup can defeat — so both block types go in,
// in one list.
const markupsOf = (data) => findSyntheticBlocks(data).map(htmlOf);

/**
 * @param {Object} params
 * @param {Object} params.source the source mailing: previewHtml, data, headCss
 * @param {Object} params.translatedData the copy's translated `data`
 * @param {Object} params.originalTexts every extracted text, by key
 * @param {Object} params.translations every translation, by key
 * @returns {Promise<{ html: string, missedComposedBlocks: number }>} the
 *   copy's previewHtml, sanitized, and how many rebuilt composed blocks it
 *   could not place (see swapBuilderMarkup)
 */
async function buildTranslatedPreview({
  source,
  translatedData,
  originalTexts,
  translations,
}) {
  const htmlCodes = markupsOf(source.data);
  // Only the generic keys. A composed block's texts reach the preview
  // through the swap below; replaced here as strings, their source
  // wording would also be rewritten wherever else it appears — in a
  // template block the protection config keeps, in an attribute.
  const { rest: genericOriginals } = splitBuilderTranslations(originalTexts);
  const { rest: genericTranslations } = splitBuilderTranslations(translations);
  const translated = await runTranslationStep('updatePreview', () =>
    updatePreviewWithTranslations(
      source.previewHtml,
      genericOriginals,
      genericTranslations,
      { htmlCodes }
    )
  );

  // A composed block's markup is protected from the string replacement
  // above — it is generated, and a replacement loose inside it would
  // corrupt markup nobody typed. It was rebuilt from the translated
  // state instead, so the zone is swapped wholesale here. Without this
  // the preview would keep showing the source language while the stored
  // block had already moved on.
  const translatedMarkups = markupsOf(translatedData);
  const swapped = await runTranslationStep('swapBuilderMarkup', () =>
    swapBuilderMarkup(translated, htmlCodes, translatedMarkups)
  );

  // Provider output was injected into previewHtml above; sanitize the
  // final document before persisting it (stored-XSS protection — the
  // preview is later served as text/html). Serving it sanitizes it again.
  //
  // The synthetic zones are put back as they are. An HTML code block holds
  // no provider output (it is excluded from translation), and sanitizing it
  // stripped the ESP scripts it exists for, so the copy's ZIP no longer
  // matched its export. A composed zone does hold provider text, inside
  // markup regenerated from it: what protects it is the generator, which
  // escapes every value for the slot it lands in (rich text through an
  // allow-list), not the sanitizer.
  //
  // The zones are matched on the markup the copy holds now — the rebuilt
  // one for composed blocks. One that matches no stored markup is still
  // found by counting `<div>` from its marker, and kept out all the same.
  const sanitized = await runTranslationStep('sanitizePreview', () =>
    transformDocumentKeepingHtmlCodeBlocks(
      swapped.html,
      sanitizePreviewHtml,
      translatedMarkups
    )
  );

  // The head CSS is put back as stored for the same reason: the sanitizer
  // drops a whole <style> whose text holds `<` and a letter — a
  // `/* <table> */` comment, an SVG data URI — and the copy's previewHtml
  // is what its multi-mailing ZIP exports. Only while the copy holds an
  // HTML code block, as in the editor's export: without one, the CSS has
  // nothing to style and is left out (head-css-guard.js).
  const html = await runTranslationStep('injectHeadCss', () =>
    injectHeadCss(
      sanitized,
      headCssToExport({ data: translatedData, headCss: source.headCss })
    )
  );
  return { html, missedComposedBlocks: swapped.missed };
}

/**
 * Builds the copy's previewHtml and stores it.
 *
 * A failure here is logged and reported as `previewGenerated: false`, never
 * thrown: the translated copy already exists, and losing its preview is not a
 * reason to mark the whole job failed.
 *
 * @param {Object} params see buildTranslatedPreview, plus `copyId`
 * @returns {Promise<{ previewGenerated: boolean,
 *   missedComposedBlocks: number }>}
 */
async function storeTranslatedPreview({ copyId, ...params }) {
  const nothing = { previewGenerated: false, missedComposedBlocks: 0 };
  if (!params.source.previewHtml) {
    logger.log(
      '[Translation] No previewHtml on original mailing, skipping preview update'
    );
    return nothing;
  }

  try {
    logger.log('[Translation] Updating preview HTML via string replacement...');
    const { html, missedComposedBlocks } = await buildTranslatedPreview(params);
    await mailingService.updatePreviewHtml(copyId, html);
    logger.log('[Translation] Preview HTML updated successfully');
    return { previewGenerated: true, missedComposedBlocks };
  } catch (error) {
    logger.error(`[Translation] Preview update failed: ${error.message}`);
    return nothing;
  }
}

module.exports = { buildTranslatedPreview, storeTranslatedPreview };
