'use strict';

const { SYNTHETIC_BLOCKS } = require('./block-types.js');

// Keeps the markup of a synthetic block out of the CSS inliner.
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
//
// Since export-substitution.js landed, an export renders an inert marker here
// instead of the markup, so during an export there is usually only a text node to
// move and juice could not have styled anything anyway. This stays as the safety
// net for any render that reaches the inliner WITHOUT a substitution session open,
// where the markup is injected directly.

/**
 * Detach the markup of every synthetic block.
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
  const selector = SYNTHETIC_BLOCKS.map((d) => '.' + d.markerClass).join(',');
  $(selector, doc).each(function (index, element) {
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
