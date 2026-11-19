'use strict';

const ko = require('knockout');
const { stripMergeTags } = require('./merge-tag-syntax');
const { EMOJI_REGEX } = require('./emoji');

// The copy that lives outside the blocks: the subject (email metadata) and the
// preheader (a template property). Both are the client's to write.

/**
 * The subject being edited, or null when the company does not use the email
 * metadata: the editor then knows nothing of the subject (the ESP holds it).
 * @returns {string|null}
 */
function getSubject(viewModel) {
  const store = viewModel.emailMetadataStore;
  if (!store || !store.isActive || !store.isActive()) return null;
  const { subject } = store.snapshot();
  return typeof subject === 'string' ? subject : '';
}

// Where a template declares its preheader, shared with the share page.
const {
  PREHEADER_PATHS,
} = require('../../../../../shared/quality/preheader.js');

// Some templates declare one preheader per market instead (`autPreheaderText`,
// `bel_frPreheaderText`…), each bound to its own block: which one the email
// sends cannot be told, so none is judged.
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
 * The preheader of the email, or null when the template has none, or several.
 * @returns {{ value: string, templateDefault: string, turnedOff: boolean }|null}
 */
function getPreheader(viewModel) {
  const content = viewModel.content() || {};
  const path = PREHEADER_PATHS.find(
    (candidate) => typeof read(content, candidate) === 'string'
  );
  if (!path) return null;
  const perMarket = keysOf(content)
    .concat(keysOf(content.preheaderBlock))
    .some((key) => MARKET_PREHEADER.test(key));
  if (perMarket) return null;
  const defaults = viewModel.templateDefaults || {};
  return {
    value: read(content, path),
    templateDefault: read(defaults, path) || '',
    // versafix-like templates can switch the preheader off entirely.
    turnedOff: ko.unwrap(content.preheaderVisible) === false,
  };
}

/**
 * The length of a subject or preheader as an inbox shows it: merge tags out
 * (their value is only known at send time), one emoji one character whatever
 * its code points, and accents composed (an é typed as e + ´ is one).
 */
const inboxLength = (text) =>
  Array.from(
    stripMergeTags(text)
      .normalize('NFC')
      .replace(EMOJI_REGEX, 'x')
      .replace(/\s+/g, ' ')
      .trim()
  ).length;

module.exports = { getSubject, getPreheader, inboxLength, PREHEADER_PATHS };
