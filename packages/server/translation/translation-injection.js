'use strict';

const { injectTexts } = require('./mosaico-text-injector.js');
const {
  splitBuilderTranslations,
  injectBuilderTexts,
} = require('./builder-block-texts.js');
const { runTranslationStep } = require('./translation-step.utils.js');
const logger = require('../utils/logger.js');

// Writing a mailing's translations back: the generic texts into the model,
// the composed blocks' texts into their state — and their markup rebuilt.
//
// The two kinds of key are separated first: a builder key is not a path into
// the model, so the generic injector would walk into nothing and report a
// failure nobody can act on.

/**
 * @param {Object} builderStats what injectBuilderTexts reported
 */
function logBuilderStats(builderStats) {
  if (builderStats.oversized > 0) {
    logger.warn(
      `[Translation] ${builderStats.oversized} composed block(s) left untranslated: ` +
        'the rebuilt markup would exceed the stored size limit.'
    );
  }

  if (builderStats.outdated > 0) {
    logger.warn(
      `[Translation] ${builderStats.outdated} composed block(s) written by another generator version: ` +
        'their rebuilt markup follows the current one.'
    );
  }

  if (builderStats.skipped.length > 0) {
    logger.warn(
      `[Translation] ${builderStats.skipped.length} composed-block key(s) dropped: ` +
        builderStats.skipped.join(', ')
    );
  }
}

/**
 * @param {Object} mailing { name, data, ... }, left untouched
 * @param {Object} translations every translated key, generic and builder
 * @returns {Promise<{ mailing: Object, injected: number, failed: number,
 *   builder: Object }>} the translated clone, and what each injector did
 */
async function injectTranslations(mailing, translations) {
  const { builder, rest } = splitBuilderTranslations(translations);

  const {
    mailing: translatedMailing,
    stats: injectionStats,
  } = await runTranslationStep('injectTexts', () => injectTexts(mailing, rest));

  // Composed blocks are not just written back, they are REBUILT: `builderHtml`
  // is what gets exported, so leaving it alone would ship an email whose stored
  // markup is still in the source language while its state says otherwise.
  // Same generator as the editor — which is why it is a shared module.
  const builderStats = await runTranslationStep('injectBuilderTexts', () =>
    injectBuilderTexts(translatedMailing.data, builder)
  );
  logBuilderStats(builderStats);

  return {
    mailing: translatedMailing,
    injected: injectionStats.injected + builderStats.applied,
    failed: injectionStats.failed,
    builder: builderStats,
  };
}

module.exports = { injectTranslations };
