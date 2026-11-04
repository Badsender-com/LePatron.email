'use strict';

const ko = require('knockout');
const {
  injectBlockTranslations,
} = require('../../utils/block-content-extractor');

/**
 * The template's preheader, for text generation (epic #1163).
 *
 * Templates declare it in one of two places (docs/TEMPLATE_DEVELOPER_GUIDE.md,
 * preheader): at the root of the content, or in a root-level preheader block.
 * A template that switches it off (`preheaderVisible: false`) is treated as
 * having none: a text written there would show nowhere, so the proposal is
 * offered to copy instead.
 */
const PREHEADER_PATHS = ['preheaderText', 'preheaderBlock.preheaderText'];

const valueAt = (object, path) =>
  path
    .split('.')
    .reduce((value, key) => (value == null ? undefined : value[key]), object);

/**
 * @param {Object} content the editor content, unwrapped (`ko.toJS(viewModel.content())`)
 * @returns {{ path: string, value: string } | null}
 */
function findPreheader(content) {
  if (!content || content.preheaderVisible === false) return null;
  const path = PREHEADER_PATHS.find(
    (candidate) => typeof valueAt(content, candidate) === 'string'
  );
  return path ? { path, value: valueAt(content, path) } : null;
}

/**
 * Write the preheader into the editor content, through its observables.
 *
 * @param {Function} contentObservable `viewModel.content`
 * @param {string} value
 * @returns {boolean} false when the template has no preheader to write into
 */
function writePreheader(contentObservable, value) {
  const preheader = findPreheader(ko.toJS(contentObservable()));
  if (!preheader) return false;
  injectBlockTranslations(contentObservable, { [preheader.path]: value });
  return true;
}

module.exports = { findPreheader, writePreheader };
