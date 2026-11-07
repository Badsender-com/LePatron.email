'use strict';

const ko = require('knockout');
const {
  injectBlockTranslations,
} = require('../utils/block-content-extractor');
// Where a template declares its preheader, shared with the share page.
const { PREHEADER_PATHS } = require('../../../../shared/quality/preheader.js');

/**
 * The preheader of the email: the one accessor that quality control and the
 * AI actions read and write it through (ADR 0010), the counterpart of
 * ext/email-subject.js.
 *
 * The preheader is a template property. Templates declare it in one of two
 * places (docs/TEMPLATE_DEVELOPER_GUIDE.md, preheader): at the root of the
 * content, or in a root-level preheader block. Some templates can switch it
 * off (`preheaderVisible: false`): it can then be read, and quality control
 * says so, but a text written there would show nowhere.
 */

// Some templates declare one preheader per market instead (`autPreheaderText`,
// `bel_frPreheaderText`…), each bound to its own block: which one the email
// sends cannot be told, so none is read nor written.
const MARKET_PREHEADER = /.PreheaderText$/;

// One property read along a path, unwrapping observables step by step: the
// whole content model is never unfolded for two strings.
const read = (object, path) =>
  path.reduce(
    (value, key) =>
      value == null ? undefined : ko.unwrap(ko.unwrap(value)[key]),
    object
  );

const keysOf = (value) => Object.keys(ko.unwrap(value) || {});

/**
 * The preheader, or null when the template has none, or several.
 * @returns {{ path: string, value: string, templateDefault: string, turnedOff: boolean }|null}
 */
function readPreheader(viewModel) {
  const content = viewModel.content() || {};
  const path = PREHEADER_PATHS.find(
    (candidate) => typeof read(content, candidate) === 'string'
  );
  if (!path) return null;
  const perMarket = keysOf(content)
    .concat(keysOf(content.preheaderBlock))
    .some((key) => MARKET_PREHEADER.test(key));
  if (perMarket) return null;
  return {
    path: path.join('.'),
    value: read(content, path),
    templateDefault: read(viewModel.templateDefaults || {}, path) || '',
    turnedOff: ko.unwrap(content.preheaderVisible) === false,
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
