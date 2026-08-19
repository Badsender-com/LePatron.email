'use strict';

const { HTML_CODE_MARKER_CLASS } = require('./constants.js');

// Keeps the pasted markup of an "HTML code" block out of the CSS inliner.
//
// juice inlines every `<style data-inline="true">` rule of the template onto the
// whole document. Those rules are generic — versafix ships
// `img { border: 0px; display: block; }` — so an `<img>` the user pasted would
// silently gain `style="border:0;display:block"`, and an inline image inside a
// link would turn into a block.
//
// So the pasted nodes are detached before the inliner runs and put back straight
// after. Only the *contents* of the marker element are moved: the wrapper itself
// is LePatron's own markup and keeps behaving like any other template element.
//
// Purely additive: with no HTML code block in the document there is nothing to
// detach and the inlining is bit-for-bit what it was before.

/**
 * Detach the pasted markup of every HTML code block.
 *
 * Must run BEFORE the inliner copies `style` into `replacedstyle`: otherwise the
 * pasted nodes get a `replacedstyle` copy of their own `style`, which the export
 * regexes in viewmodel.js would then restore over the original attribute.
 *
 * @param {Function} $ jQuery
 * @param {Document} doc the document about to be inlined
 * @returns {Array} opaque handles to pass back to restorePastedMarkup
 */
function detachPastedMarkup($, doc) {
  const detached = [];
  $('.' + HTML_CODE_MARKER_CLASS, doc).each(function (index, element) {
    const $holder = $(element);
    // `contents()` covers text and comment nodes too — conditional comments in
    // the pasted markup must survive as-is.
    const contents = $holder.contents();
    if (!contents.length) return;
    detached.push({ holder: $holder, contents: contents.detach() });
  });
  return detached;
}

/**
 * Put the pasted markup back, in its original order.
 *
 * @param {Array} detached the value returned by detachPastedMarkup
 */
function restorePastedMarkup(detached) {
  if (!Array.isArray(detached)) return;
  detached.forEach(function (entry) {
    entry.holder.append(entry.contents);
  });
}

module.exports = { detachPastedMarkup, restorePastedMarkup };
