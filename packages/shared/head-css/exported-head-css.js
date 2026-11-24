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
// hand-written rule can still override a generated one.

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

  return derived + author;
}

module.exports = { exportedHeadCss };
