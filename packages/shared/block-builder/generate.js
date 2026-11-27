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
const {
  generateRow,
  COLUMN_ROW_ATTRIBUTE,
  COLUMN_INDEX_ATTRIBUTE,
  COLUMN_CHROME_CLASS,
} = require('./row-markup.js');
const { escapeForContext, COLOR, PX } = require('./slot-contexts.js');
const { BLOCK_WIDTH } = require('./row-layout.js');
const {
  flatRowOf,
  singleColumnRows,
  withoutEmptyRows,
} = require('./composition.js');

// Bumped when the shape of a state changes in a way a reader must know about.
// The latest version this code reads and writes: 1 stores a flat `elements`
// list, 2 stores `rows` of columns. Which one a composition is written in is
// decided by its shape (see serialiseState in state.js).
const STATE_VERSION = 2;

// Bumped when a template changes in a way that alters rendered output. A block
// whose stored `gen` is behind can be offered an update; it is never updated
// on its own.
//   1.1.0 — the block holds to its width, centred, rather than 100%.
const GENERATOR_VERSION = '1.1.0';

const DEFAULT_BLOCK = {
  backgroundColor: 'transparent',
  paddingTop: 0,
  paddingBottom: 0,
};

/**
 * The row a composition renders as a flat list from, or null when it renders
 * rows.
 *
 * What is written is judged on the rows that hold something (flatRowOf), so a
 * flat block with an empty row added keeps its markup to the byte. The
 * preview's chrome renders every row instead, empty ones included, so there a
 * second row — empty or not — is a composition of rows. Whoever reads the
 * preview (the drag, which aims at its columns) asks here, so it and the
 * markup can never disagree on whether there are columns to aim at.
 *
 * @param {Object} state
 * @param {Object} [options] see generate
 * @returns {Object|null}
 */
function renderedFlatRow(state, options) {
  const rows = state && Array.isArray(state.rows) ? state.rows : [];
  if (options && options.chrome && rows.length > 1) return null;
  return flatRowOf(state);
}

/**
 * @param {Object} state
 * @param {Object} [options]
 * @param {boolean} [options.elementIds] mark each element with its id.
 *   Editing chrome — see ELEMENT_ATTRIBUTE. Off unless the preview asks.
 * @param {boolean} [options.chrome] the preview's own markup around the
 *   elements: every column marked with its row and its index (see
 *   COLUMN_ROW_ATTRIBUTE), and the rows that hold nothing rendered too, as
 *   empty columns to drop into. Off unless the preview asks; never in what is
 *   stored, where a row holding nothing is not written.
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
  // byte for byte; anything else renders its rows. Without chrome, both are
  // judged on the rows that are written (withoutEmptyRows), as the stored
  // shape is, so the applied markup and the server's rebuild agree. With it,
  // every row is rendered (see renderedFlatRow).
  const flatRow = renderedFlatRow(state, options);
  let body;
  if (!flatRow) {
    const rows =
      options && options.chrome && Array.isArray(state.rows)
        ? state.rows
        : withoutEmptyRows(state.rows);
    body = rows.map((row) => generateRow(row, options)).join('');
  } else {
    const cells = flatRow.columns[0].elements
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

  // Held to the width it is laid out for (BLOCK_WIDTH, the px its rows are
  // counted in), centred: a template's block slot can be wider than its
  // content — each native block centring its own table in it — and a block at
  // 100% spread over all of it, its columns wider than set. The attribute is
  // what Outlook on Windows reads; `max-width:100%` lets every other client
  // shrink it to a phone.
  return (
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0"' +
    ` width="${BLOCK_WIDTH}" align="center" bgcolor="${background}"` +
    ` style="width:${BLOCK_WIDTH}px;max-width:100%;background-color:${background};">` +
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
  renderedFlatRow,
  generateElement,
  renderElement,
  elementAttributes,
  emptyState,
  STATE_VERSION,
  GENERATOR_VERSION,
  ELEMENT_ATTRIBUTE,
  STARTER_ATTRIBUTE,
  COLUMN_ROW_ATTRIBUTE,
  COLUMN_INDEX_ATTRIBUTE,
  COLUMN_CHROME_CLASS,
  DEFAULT_BLOCK,
  isBlankRichText,
};
