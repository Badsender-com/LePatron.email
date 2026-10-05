'use strict';

const {
  HTML_CODE_MAX_LENGTH,
  BUILDER_STATE_MAX_LENGTH,
} = require('./block-types.js');

// Named constants for the synthetic blocks' editor code, beyond what their
// descriptors hold. A block's type, properties and classes are read from the
// descriptor itself (block-types.js), never declared a second time here — two
// spellings of `lp-html-block` would drift, and the one that drifted would be
// the one nothing renders.
//
// See packages/shared/synthetic-blocks.js for the limits below.

// Knockout binding rendering the raw markup of either synthetic block. One
// binding for both: what it does — neutralise in the canvas, hand an inert
// marker to the export — depends on the rendering mode, never on which block
// asked.
const HTML_CODE_BINDING = 'lpHtmlCode';

module.exports = {
  HTML_CODE_BINDING,
  HTML_CODE_MAX_LENGTH,
  BUILDER_STATE_MAX_LENGTH,
};
