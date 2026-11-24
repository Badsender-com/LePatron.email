'use strict';

// Turns a builder state into the HTML of one block.
//
// The state is the source of truth for EDITING. The HTML it produces is what
// gets stored and exported, and it is frozen once written: a later fix to a
// template must not silently rewrite an email a client already approved. That
// is what `v` and `gen` are for — a stored block records which schema and which
// generator produced it, so a divergence can be surfaced rather than applied.
//
// A composition is rows of columns (see composition.js). One that is a single
// full-width column renders exactly as the flat list it was before columns.
// What one element renders is element-markup.js; what a row of columns renders
// is row-markup.js. This module decides the block around them.

const {
  generateElement,
  renderElement,
  elementAttributes,
  isBlankRichText,
  ELEMENT_ATTRIBUTE,
  STARTER_ATTRIBUTE,
} = require('./element-markup.js');
const { generateRow } = require('./row-markup.js');
const { escapeForContext, COLOR, PX } = require('./slot-contexts.js');
const {
  isFlatComposition,
  singleColumnElements,
  singleColumnRows,
} = require('./composition.js');

// Bumped when the shape of a state changes in a way a reader must know about.
// The latest version this code reads and writes: 1 stores a flat `elements`
// list, 2 stores `rows` of columns. Which one a composition is written in is
// decided by its shape (see serialiseState in state.js).
const STATE_VERSION = 2;

// Bumped when a template changes in a way that alters rendered output. A block
// whose stored `gen` is behind can be offered an update; it is never updated
// on its own.
const GENERATOR_VERSION = '1.0.0';

const DEFAULT_BLOCK = {
  backgroundColor: 'transparent',
  paddingTop: 0,
  paddingBottom: 0,
};

/**
 * @param {Object} state
 * @param {Object} [options]
 * @param {boolean} [options.elementIds] mark each row with its element id.
 *   Editing chrome — see ELEMENT_ATTRIBUTE. Off unless the preview asks.
 * @param {Object} [options.starters] by element type, `{ key, text }`: what an
 *   element shows while its `key` is blank, so a fresh one is visible in the
 *   preview at all. Editing chrome too — see STARTER_ATTRIBUTE. The words are
 *   rendered through the slot's own escaping, and never reach the state.
 * @returns {string} the block's markup, or an empty string for an empty state
 */
function generate(state, options) {
  if (!state || typeof state !== 'object') return '';

  // `.map(fn)` would hand the index as a second argument, which is exactly
  // where the options go — everything after the first entry would get
  // `elementIds` from a number.
  // Each branch produces markup that stands on its own inside the block's
  // cell: a row is already a table, and the flat list's rows need one around
  // them. Deciding that here rather than wrapping afterwards is what keeps a
  // single-column composition rendering exactly as it did.
  //
  // Which shape renders follows the shape of the composition, the same rule
  // that decides how it is stored: a flat one — one row of one full-width
  // column, nothing set on either — renders as the flat list it always was,
  // byte for byte; anything else renders its rows.
  let body;
  if (!isFlatComposition(state)) {
    body = (Array.isArray(state.rows) ? state.rows : [])
      .map((row) => generateRow(row, options))
      .join('');
  } else {
    const cells = singleColumnElements(state)
      .map((element) => generateElement(element, options))
      .join('');
    body =
      cells === ''
        ? ''
        : '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">' +
          cells +
          '</table>';
  }

  // An empty block exports nothing at all — same rule as the HTML code block,
  // whose empty root had to be stripped to avoid shipping a bare <div>.
  if (body === '') return '';

  const block = { ...DEFAULT_BLOCK, ...(state.block || {}) };
  const background = escapeForContext(
    block.backgroundColor,
    COLOR,
    DEFAULT_BLOCK.backgroundColor
  );
  const paddingTop = escapeForContext(block.paddingTop, PX, 0);
  const paddingBottom = escapeForContext(block.paddingBottom, PX, 0);

  return (
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"' +
    ` bgcolor="${background}"` +
    ` style="background-color:${background};">` +
    '<tr>' +
    `<td style="padding:${paddingTop}px 0 ${paddingBottom}px 0;">` +
    body +
    '</td>' +
    '</tr>' +
    '</table>'
  );
}

/**
 * The state a brand new block starts from.
 *
 * @returns {Object}
 */
function emptyState() {
  return {
    v: STATE_VERSION,
    gen: GENERATOR_VERSION,
    block: { ...DEFAULT_BLOCK },
    // One row of one full-width column, so a new composition always has
    // somewhere to put an element.
    rows: singleColumnRows(),
  };
}

module.exports = {
  generate,
  generateElement,
  renderElement,
  elementAttributes,
  emptyState,
  STATE_VERSION,
  GENERATOR_VERSION,
  ELEMENT_ATTRIBUTE,
  STARTER_ATTRIBUTE,
  DEFAULT_BLOCK,
  isBlankRichText,
};
