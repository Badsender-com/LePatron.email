'use strict';

const ko = require('knockout');
const {
  injectBlockTranslations,
} = require('../utils/block-content-extractor');

/**
 * The preheader of the email: the one accessor that quality control and the
 * AI actions read and write it through (ADR 0004), the counterpart of
 * ext/email-subject.js.
 *
 * The preheader is a template property. Templates declare it in one of two
 * places (docs/TEMPLATE_DEVELOPER_GUIDE.md, preheader): at the root of the
 * content, or in a root-level preheader block. Some templates can switch it
 * off (`preheaderVisible: false`): it can then be read, and quality control
 * says so, but a text written there would show nowhere.
 */
const PREHEADER_PATHS = ['preheaderText', 'preheaderBlock.preheaderText'];

const valueAt = (object, path) =>
  path
    .split('.')
    .reduce((value, key) => (value == null ? undefined : value[key]), object);

/**
 * The preheader, or null when the template has none.
 * @returns {{ path: string, value: string, templateDefault: string, turnedOff: boolean }|null}
 */
function readPreheader(viewModel) {
  const content = ko.toJS(viewModel.content()) || {};
  const path = PREHEADER_PATHS.find(
    (candidate) => typeof valueAt(content, candidate) === 'string'
  );
  if (!path) return null;
  return {
    path,
    value: valueAt(content, path),
    templateDefault: valueAt(viewModel.templateDefaults || {}, path) || '',
    turnedOff: content.preheaderVisible === false,
  };
}

/**
 * Whether there is a preheader to write into: declared, and not switched off.
 * @returns {boolean}
 */
function canWritePreheader(viewModel) {
  const preheader = readPreheader(viewModel);
  return Boolean(preheader && !preheader.turnedOff);
}

/**
 * Write the preheader into the editor content, through its observables.
 * @returns {boolean} false when there is no preheader to write into
 */
function writePreheader(viewModel, value) {
  const preheader = readPreheader(viewModel);
  if (!preheader || preheader.turnedOff) return false;
  injectBlockTranslations(viewModel.content, { [preheader.path]: value });
  return true;
}

module.exports = {
  readPreheader,
  canWritePreheader,
  writePreheader,
  PREHEADER_PATHS,
};
