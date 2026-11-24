'use strict';

const {
  stylesheetForComposedBlocks,
} = require('../block-builder/block-stylesheet.js');

// Which stylesheet an export carries: the one rule, for the editor and the
// server alike.
//
// The editor applies it to what it exports and shows on the canvas
// (packages/editor/src/js/ext/head-css/exported-css.js); the server to the
// copies it writes itself, such as a translated duplicate's previewHtml
// (packages/server/mailing/head-css-export.js). Each only collects the inputs
// from its own content model — Knockout there, plain objects here — so the
// two can never apply the rule differently.
//
// TWO sources, gated differently because they are different things:
//
//   - the DERIVED stylesheet needs no gate. It is computed from the composed
//     blocks, so it cannot exist without one: a mailing with none derives an
//     empty string by construction;
//   - the AUTHOR's stylesheet follows the HTML code blocks, not the template
//     flag. It exists to style markup pasted in one, so it is exported while
//     the mailing holds at least one — flag on or off, since turning the flag
//     off keeps existing blocks — and left out once the last one is gone. It
//     stays stored on the mailing: an undo, or a block added back, gets it
//     back as it was.
//
// Derived first, author last: at equal specificity the later rule wins, so a
// hand-written rule can still override a generated one. Except for what CSS
// only reads at the very top of a stylesheet — see leadingStatementsOf.

// What CSS only accepts before any other rule. An `@import` after a rule is
// ignored, and so is a `@namespace`; a `@layer` statement (no block) may sit
// among the imports and declares the order they load into. Lowercase: matched
// on the at-keyword, case-insensitively.
const LEADING_AT_RULES = new Set(['charset', 'import', 'layer', 'namespace']);

const AT_KEYWORD = /^@([a-z-]+)/i;

/**
 * Where whitespace and comments starting at `index` end.
 *
 * @param {string} css
 * @param {number} index
 * @returns {number}
 */
function skipBlank(css, index) {
  let at = index;
  for (;;) {
    while (at < css.length && /\s/.test(css[at])) at++;
    if (!css.startsWith('/*', at)) return at;
    const close = css.indexOf('*/', at + 2);
    // An unterminated comment runs to the end: nothing after it is a rule.
    if (close === -1) return css.length;
    at = close + 2;
  }
}

/**
 * Where the statement at-rule starting at `index` ends, just past its `;`, or
 * -1 when it is not one: it opens a block, or never ends.
 *
 * Quotes and parentheses are skipped, so a `;` inside `url(...)` or a quoted
 * URL does not end it.
 *
 * @param {string} css
 * @param {number} index
 * @returns {number}
 */
function statementEnd(css, index) {
  let depth = 0;
  let quote = null;

  for (let at = index; at < css.length; at++) {
    const char = css[at];

    if (char === '\\') {
      at++;
    } else if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '(') {
      depth++;
    } else if (char === ')') {
      if (depth > 0) depth--;
    } else if (depth === 0 && char === ';') {
      return at + 1;
    } else if (depth === 0 && (char === '{' || char === '}')) {
      return -1;
    }
  }

  return -1;
}

/**
 * The author's stylesheet, split after the statements CSS only reads at its
 * top: `@charset`, `@import`, `@namespace` and `@layer` statements, with the
 * comments between them.
 *
 * Those have to stay above the derived rules, or the browser drops them: a
 * web font loaded by `@import` would vanish from every export of a mailing
 * with columns. Everything else keeps its place after the derived rules.
 *
 * Exact, so `head + rest` is the author's stylesheet byte for byte. A
 * statement that does not end with `;` stays in `rest`: moved above the
 * derived rules, it would swallow them.
 *
 * @param {string} css
 * @returns {{ head: string, rest: string }}
 */
function leadingStatementsOf(css) {
  let end = 0;
  let at = skipBlank(css, 0);

  for (;;) {
    const keyword = AT_KEYWORD.exec(css.slice(at, at + 16));
    if (!keyword || !LEADING_AT_RULES.has(keyword[1].toLowerCase())) break;
    const next = statementEnd(css, at);
    if (next === -1) break;
    end = next;
    at = skipBlank(css, next);
  }

  return { head: css.slice(0, end), rest: css.slice(end) };
}

/**
 * The stylesheet an export of this content carries.
 *
 * @param {Object} params
 * @param {Array<string>} params.composedStates the stored `builderState` of
 *   every composed block, in document order
 * @param {boolean} params.hasHtmlCodeBlock whether the content holds at least
 *   one HTML code block, empty or not
 * @param {*} params.authorCss the head CSS stored on the mailing
 * @returns {string}
 */
function exportedHeadCss({ composedStates, hasHtmlCodeBlock, authorCss }) {
  const derived = stylesheetForComposedBlocks(composedStates);
  const author =
    hasHtmlCodeBlock && typeof authorCss === 'string' ? authorCss : '';

  if (derived === '') return author;

  const { head, rest } = leadingStatementsOf(author);
  return head + derived + rest;
}

module.exports = { exportedHeadCss, leadingStatementsOf };
