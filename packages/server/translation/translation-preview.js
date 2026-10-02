'use strict';

const mailingService = require('../mailing/mailing.service');
const { updatePreviewWithTranslations } = require('./preview-html-updater');
const { sanitizePreviewHtml } = require('../utils/preview-html-sanitizer.js');
const {
  transformDocumentKeepingHtmlCodeBlocks,
} = require('./html-code-block-protection.js');
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
 * @returns {Promise<string>} the copy's previewHtml, sanitized
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
  const previewHtml = await runTranslationStep('swapBuilderMarkup', () =>
    swapBuilderMarkup(translated, htmlCodes, translatedMarkups)
  );

  // Provider output was injected into previewHtml above; sanitize the
  // final document before persisting it (stored-XSS protection — the
  // preview is later served as text/html). The HTML code blocks are put
  // back as stored: they hold no provider output, and sanitizing them
  // stripped the ESP scripts they exist for, so the copy's ZIP no longer
  // matched its export. Serving the preview sanitizes it again.
  //
  // Located on what the document holds NOW: the composed blocks carry
  // their rebuilt markup since the swap above, so matching on the stored
  // originals would miss them and let the sanitiser into a generated
  // zone.
  const sanitized = await runTranslationStep('sanitizePreview', () =>
    transformDocumentKeepingHtmlCodeBlocks(
      previewHtml,
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
  return runTranslationStep('injectHeadCss', () =>
    injectHeadCss(
      sanitized,
      headCssToExport({ data: translatedData, headCss: source.headCss })
    )
  );
}

/**
 * Builds the copy's previewHtml and stores it.
 *
 * A failure here is logged and reported as `false`, never thrown: the
 * translated copy already exists, and losing its preview is not a reason to
 * mark the whole job failed.
 *
 * @param {Object} params see buildTranslatedPreview, plus `copyId`
 * @returns {Promise<boolean>} whether a preview was stored
 */
async function storeTranslatedPreview({ copyId, ...params }) {
  if (!params.source.previewHtml) {
    logger.log(
      '[Translation] No previewHtml on original mailing, skipping preview update'
    );
    return false;
  }

  try {
    logger.log('[Translation] Updating preview HTML via string replacement...');
    const html = await buildTranslatedPreview(params);
    await mailingService.updatePreviewHtml(copyId, html);
    logger.log('[Translation] Preview HTML updated successfully');
    return true;
  } catch (error) {
    logger.error(`[Translation] Preview update failed: ${error.message}`);
    return false;
  }
}

module.exports = { buildTranslatedPreview, storeTranslatedPreview };
