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

// Identifies an element in the rendered markup, so a click can select the one it
// landed on and a drag can pick it up.
//
// OFF BY DEFAULT, and that is the point: this is editing chrome, and what
// `generate` returns is what gets stored and mailed. An internal id in a
// recipient's inbox is noise at best — it survives the export untouched, since
// the markup is substituted verbatim after every other pass has run, so nothing
// downstream would ever strip it.
//
// The preview asks for it explicitly (`{ elementIds: true }`); the apply path
// and the control gallery do not.
const ELEMENT_ATTRIBUTE = 'data-lp-el';

// Marks a row that shows its starter rather than anything the user wrote — see
// the `starters` option. Editing chrome, off by default, for the same reason as
// ELEMENT_ATTRIBUTE: only the preview asks for starters, so only the preview
// ever carries it. Its value is the element type, for the preview's stylesheet.
const STARTER_ATTRIBUTE = 'data-lp-starter';

const DEFAULT_BLOCK = {
  backgroundColor: 'transparent',
  paddingTop: 0,
  paddingBottom: 0,
};

// Blank as a reader sees it: a rich text the editor emptied can still hold a
// `<br>` or a non-breaking space, and renders nothing all the same. Shared with
// the modal's rich-text field, whose placeholder shows exactly when the
// generator would render the starter text instead.
function isBlankRichText(value) {
  if (typeof value !== 'string') return true;
  return (
    value
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;|\u00a0/g, ' ')
      .trim() === ''
  );
}

// The values to render in place of a blank slot, or null when the element has
// no starter or is not blank. A starter without `text` only marks the row: the
// preview's stylesheet has something to draw, and nothing is substituted.
function starterValues(type, values, options) {
  const starters = options && options.starters;
  if (!starters || !Object.prototype.hasOwnProperty.call(starters, type)) {
    return null;
  }
  const starter = starters[type];
  if (!starter || !isBlankRichText(values[starter.key])) return null;
  return typeof starter.text === 'string'
    ? { ...values, [starter.key]: starter.text }
    : values;
}

/**
 * An element's own markup, with nothing around it.
 *
 * Separate from `generateElement` because the row an element used to carry is
 * not always the right wrapper. Inside a column's cell it is the wrong one:
 * a `<tr>` directly inside a `<td>` is invalid, and browsers drop it along
 * with everything in it — the element would simply vanish from the email.
 *
 * So what an element renders and what it is wrapped in are now two decisions,
 * and whoever places it makes the second one.
 *
 * @param {Object} element one entry of a column's `elements`
 * @param {Object} [options] see generate
 * @returns {string} the element's markup, unwrapped
 */
function renderElement(element, options) {
  if (!element || typeof element !== 'object') return '';

  const definition = elementFor(element.type);
  // An unknown type means a state written by a newer version, or a corrupted
  // one. Skipping it keeps the rest of the block renderable.
  if (!definition) return '';

  const values = { ...definition.defaults, ...element };
  return definition.render(
    starterValues(definition.type, values, options) || values
  );
}

/**
 * The editing chrome an element's wrapper carries, as an attribute string.
 *
 * Kept apart from the markup for the same reason: the wrapper varies, the
 * chrome does not. A column's cell needs exactly these attributes to make its
 * elements selectable and draggable, and it must not have to rebuild them —
 * two spellings of `data-lp-el` would drift, and the one that drifted would be
 * the one the preview stopped being able to find.
 *
 * Empty unless the preview asks: none of this belongs in a shipped email.
 *
 * @param {Object} element
 * @param {Object} [options] see generate
 * @returns {string} leading-space-prefixed attributes, or an empty string
 */
function elementAttributes(element, options) {
  if (!element || typeof element !== 'object') return '';

  const definition = elementFor(element.type);
  if (!definition) return '';

  const values = { ...definition.defaults, ...element };
  const starter = starterValues(definition.type, values, options);
  const id =
    options && options.elementIds ? escapeForContext(element.id, ATTR) : '';

  return (
    (id ? ` ${ELEMENT_ATTRIBUTE}="${id}"` : '') +
    (starter ? ` ${STARTER_ATTRIBUTE}="${definition.type}"` : '')
  );
}

/**
 * An element as one row of a single-column block.
 *
 * @param {Object} element one entry of `state.elements`
 * @param {Object} [options] see generate
 * @returns {string} the element's markup, in its own row
 */
function generateElement(element, options) {
  if (!element || typeof element !== 'object') return '';
  // Asked before rendering, not inferred from an empty render: an element that
  // renders nothing still occupied a row before this split, and the export has
  // to come out identical.
  if (!elementFor(element.type)) return '';

  return (
    `<tr><td${elementAttributes(element, options)}>` +
    renderElement(element, options) +
    '</td></tr>'
  );
}

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
  if (!state || !Array.isArray(state.elements)) return '';

  // `.map(generateElement)` would hand the index as a second argument, which is
  // exactly where the options go — every element after the first would get
  // `elementIds` from a number.
  const rows = state.elements
    .map((element) => generateElement(element, options))
    .join('');
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
