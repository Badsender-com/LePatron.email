'use strict';

// One element of a composition: its markup, and the editing chrome its wrapper
// carries. Whoever places the element — a row of a flat block, or a column's
// cell — decides the wrapper; this module decides everything else, once.

const { elementFor } = require('./elements/index.js');
const { escapeForContext, ATTR } = require('./slot-contexts.js');

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
 * The definition an element renders with, or null when it is nothing.
 *
 * The one rule for "this element is nothing": it is not an object, or its type
 * is unknown — a state written by a newer version, or a corrupted one. Skipping
 * it keeps the rest of the block renderable. Every known type renders a
 * complete table, so a known element always occupies its place.
 *
 * Exported so a caller that only needs to know whether a column holds
 * anything (row-markup.js, for the class a row carries) asks the same question
 * without rendering the answer.
 *
 * @param {*} element one entry of a column's `elements`
 * @returns {Object|null}
 */
function definitionOf(element) {
  if (!element || typeof element !== 'object') return null;
  return elementFor(element.type) || null;
}

/**
 * Whether an element is blank: the slot that makes it something — a text's
 * words, an image's source, a button's label, `required` in its manifest — is
 * empty. A blank element renders nothing in an email, only its starter in the
 * preview (resolveElement): the user never filled it, and an empty pill or an
 * `<img src="">` is not something to send. A divider or a spacer, with no
 * such slot, is never blank; nor is an element that is nothing (definitionOf).
 *
 * @param {*} element one entry of a column's `elements`
 * @returns {boolean}
 */
function isBlankElement(element) {
  const definition = definitionOf(element);
  if (!definition || !definition.required) return false;
  const values = { ...definition.defaults, ...element };
  return isBlankRichText(values[definition.required]);
}

/**
 * Everything about one element, worked out once: its type, its values merged
 * with the defaults, its starter, and from those its markup and its chrome.
 * Null when the element is nothing (see definitionOf), or blank outside the
 * preview (see isBlankElement).
 *
 * @param {Object} element one entry of a column's `elements`
 * @param {Object} [options] see generate
 * @param {number} [containerWidth] the room, in px, of the column it sits in.
 *   Absent for a flat block, which keeps the markup it always had.
 * @returns {{markup: string, attributes: string}|null}
 */
function resolveElement(element, options, containerWidth) {
  const definition = definitionOf(element);
  if (!definition) return null;

  const values = { ...definition.defaults, ...element };
  const starter = starterValues(definition.type, values, options);
  // Blank and not drawn as a starter: nothing, as an unknown element is.
  if (!starter && isBlankElement(element)) return null;
  const shown = starter || values;
  // What Outlook reads is a width attribute, not a style: an element that
  // writes one in px is told how much room its column has. See image.js.
  const fitted =
    containerWidth !== undefined && definition.fitWidth
      ? definition.fitWidth(shown, containerWidth)
      : shown;

  const id =
    options && options.elementIds ? escapeForContext(element.id, ATTR) : '';

  return {
    markup: definition.render(fitted),
    attributes:
      (id ? ` ${ELEMENT_ATTRIBUTE}="${id}"` : '') +
      (starter ? ` ${STARTER_ATTRIBUTE}="${definition.type}"` : ''),
  };
}

/**
 * An element's own markup, with nothing around it.
 *
 * Separate from its wrapper because the row an element used to carry is not
 * always the right one. Inside a column's cell it is the wrong one: a `<tr>`
 * directly inside a `<td>` is invalid, and browsers drop it along with
 * everything in it — the element would simply vanish from the email.
 *
 * @param {Object} element
 * @param {Object} [options] see generate
 * @returns {string} the element's markup, unwrapped, or '' for nothing
 */
function renderElement(element, options) {
  const resolved = resolveElement(element, options);
  return resolved ? resolved.markup : '';
}

/**
 * The editing chrome an element's wrapper carries, as an attribute string.
 *
 * Kept apart from the markup for the same reason: the wrapper varies, the
 * chrome does not. Empty unless the preview asks: none of this belongs in a
 * shipped email.
 *
 * @param {Object} element
 * @param {Object} [options] see generate
 * @returns {string} leading-space-prefixed attributes, or an empty string
 */
function elementAttributes(element, options) {
  const resolved = resolveElement(element, options);
  return resolved ? resolved.attributes : '';
}

/**
 * An element as one row of a flat block — the markup every block composed
 * before columns was stored with.
 *
 * @param {Object} element one entry of a flat list of elements
 * @param {Object} [options] see generate
 * @returns {string} the element's markup in its own row, or '' for nothing
 */
function generateElement(element, options) {
  const resolved = resolveElement(element, options);
  if (!resolved) return '';
  return `<tr><td${resolved.attributes}>${resolved.markup}</td></tr>`;
}

module.exports = {
  definitionOf,
  isBlankElement,
  resolveElement,
  renderElement,
  elementAttributes,
  generateElement,
  isBlankRichText,
  ELEMENT_ATTRIBUTE,
  STARTER_ATTRIBUTE,
};
