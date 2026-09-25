'use strict';

// Turns a builder state into the HTML of one block.
//
// The state is the source of truth for EDITING. The HTML it produces is what
// gets stored and exported, and it is frozen once written: a later fix to a
// template must not silently rewrite an email a client already approved. That
// is what `v` and `gen` are for — a stored block records which schema and which
// generator produced it, so a divergence can be surfaced rather than applied.
//
// Mono-column by design, for the MVP. Rows and columns are a schema change, and
// `v` is what will carry that migration.

const { elementFor } = require('./elements/index.js');
const { escapeForContext, COLOR, PX, ATTR } = require('./slot-contexts.js');

// Bumped when the shape of a state changes in a way a reader must know about.
const STATE_VERSION = 1;

// Bumped when a template changes in a way that alters rendered output. A block
// whose stored `gen` is behind can be offered an update; it is never updated
// on its own.
const GENERATOR_VERSION = '1.0.0';

// Identifies an element in the rendered markup, so the canvas can later patch
// one subtree instead of replacing the whole block, and so a click can select
// the element it landed on.
const ELEMENT_ATTRIBUTE = 'data-lp-el';

const DEFAULT_BLOCK = {
  backgroundColor: 'transparent',
  paddingTop: 0,
  paddingBottom: 0,
};

/**
 * @param {Object} element one entry of `state.elements`
 * @returns {string} the element's markup, wrapped in its identified row
 */
function generateElement(element) {
  if (!element || typeof element !== 'object') return '';

  const definition = elementFor(element.type);
  // An unknown type means a state written by a newer version, or a corrupted
  // one. Skipping it keeps the rest of the block renderable.
  if (!definition) return '';

  const values = { ...definition.defaults, ...element };
  const id = escapeForContext(element.id, ATTR);

  return (
    `<tr><td${id ? ` ${ELEMENT_ATTRIBUTE}="${id}"` : ''}>` +
    definition.render(values) +
    '</td></tr>'
  );
}

/**
 * @param {Object} state
 * @returns {string} the block's markup, or an empty string for an empty state
 */
function generate(state) {
  if (!state || !Array.isArray(state.elements)) return '';

  const rows = state.elements.map(generateElement).join('');
  // An empty block exports nothing at all — same rule as the HTML code block,
  // whose empty root had to be stripped to avoid shipping a bare <div>.
  if (rows === '') return '';

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
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">' +
    rows +
    '</table>' +
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
    elements: [],
  };
}

module.exports = {
  generate,
  generateElement,
  emptyState,
  STATE_VERSION,
  GENERATOR_VERSION,
  ELEMENT_ATTRIBUTE,
};
