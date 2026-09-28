'use strict';

const { HTML_CODE_BLOCK, BLOCK_BUILDER_BLOCK } = require('./block-types.js');

// Named constants for the "HTML code" block, derived from its descriptor rather
// than declared a second time — two spellings of `lp-html-block` would drift,
// and the one that drifted would be the one nothing renders.
//
// See block-types.js for what each of these is and why it is what it is.

const HTML_CODE_BLOCK_TYPE = HTML_CODE_BLOCK.type;
const HTML_CODE_PROPERTY = HTML_CODE_BLOCK.htmlProperty;
const HTML_CODE_MARKER_CLASS = HTML_CODE_BLOCK.markerClass;
const HTML_CODE_ROOT_CLASS = HTML_CODE_BLOCK.rootClass;

const BLOCK_BUILDER_BLOCK_TYPE = BLOCK_BUILDER_BLOCK.type;
const BLOCK_BUILDER_HTML_PROPERTY = BLOCK_BUILDER_BLOCK.htmlProperty;
const BUILDER_STATE_PROPERTY = BLOCK_BUILDER_BLOCK.stateProperty;

// Knockout binding rendering the raw markup of either synthetic block. One
// binding for both: what it does — neutralise in the canvas, hand an inert
// marker to the export — depends on the rendering mode, never on which block
// asked.
const HTML_CODE_BINDING = 'lpHtmlCode';

// Maximum length of the markup, enforced in the editor and on the server.
// `mailing.data` is an unvalidated Mixed field and `previewHtml` stores the
// rendered copy in the same document, against Mongo's 16MB per-document limit.
const HTML_CODE_MAX_LENGTH = 100000;

module.exports = {
  HTML_CODE_BLOCK_TYPE,
  HTML_CODE_PROPERTY,
  HTML_CODE_MARKER_CLASS,
  HTML_CODE_ROOT_CLASS,
  BLOCK_BUILDER_BLOCK_TYPE,
  BLOCK_BUILDER_HTML_PROPERTY,
  BUILDER_STATE_PROPERTY,
  HTML_CODE_BINDING,
  HTML_CODE_MAX_LENGTH,
};
