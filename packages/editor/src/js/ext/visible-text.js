'use strict';

// The text a reader sees in a piece of markup, read the same way by the
// quality control (the export of a block) and by the listing of a block's
// text fields (the value of a field).

const { declarationsOf } = require('./style-declarations');

// Inline declarations that hide an element from every reader. The export has
// no stylesheet applied (DOMParser renders nothing), so class-based hiding is
// out of reach. `mso-hide:all` is not here: it hides from Outlook only, and
// the text is read everywhere else.
const HIDING = {
  display: (v) => /^none\b/i.test(v),
  visibility: (v) => /^hidden\b/i.test(v),
  opacity: (v) => Number(v) === 0,
  'max-height': (v) => /^0(px)?$/i.test(v),
};

const isHidden = (el) =>
  el.nodeType === 1 &&
  declarationsOf(el).some(
    ({ prop, value }) => HIDING[prop] && HIDING[prop](value)
  );

// Block-level breaks keep words of two cells apart; an inline tag splits no
// word (`Pro<strong>mo</strong>`).
const BREAKING_TAG = /^(br|p|div|td|tr|li|h[1-6])$/i;

/**
 * The text a reader sees in an element, its spaces as the markup has them:
 * hidden descendants, scripts and styles left out, a space for each block-level
 * break.
 */
function shownTextOf(root) {
  const parts = [];
  (function walk(node) {
    if (node.nodeType === 3) parts.push(node.nodeValue);
    if (node.nodeType !== 1 && node.nodeType !== 9) return;
    if (node.nodeType === 1) {
      if (/^(script|style|template)$/i.test(node.tagName) || isHidden(node)) {
        return;
      }
      if (BREAKING_TAG.test(node.tagName)) parts.push(' ');
    }
    Array.from(node.childNodes).forEach(walk);
  })(root);
  return parts.join('');
}

/** The text a reader sees in an element, whitespace collapsed. */
const visibleTextOf = (root) => shownTextOf(root).replace(/\s+/g, ' ').trim();

module.exports = { HIDING, isHidden, shownTextOf, visibleTextOf };
