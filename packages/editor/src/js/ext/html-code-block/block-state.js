'use strict';

const ko = require('knockout');
const { HTML_CODE_BLOCK_TYPE, HTML_CODE_PROPERTY } = require('./constants.js');

// Predicates about an "HTML code" block, used by the view-model and the
// wysiwyg block template.
//
// Every level has to be unwrapped explicitly. Depending on where a block comes
// from it is either a plain object (a palette definition, straight out of
// generateModel) or a fully instrumented Knockout model (a block instance in the
// canvas, after content._wrap). In the latter case BOTH the block and each of its
// properties — `type` included — are observables. Comparing an observable to a
// string silently yields false, which is exactly how the empty-block placeholder
// first failed to ever show up.

const unwrap = (value) => ko.utils.unwrapObservable(value);

/**
 * @param {Object} block palette definition or block instance, wrapped or not
 * @returns {boolean}
 */
function isHtmlCodeBlock(block) {
  if (!block) return false;
  const unwrapped = unwrap(block);
  if (!unwrapped) return false;
  return unwrap(unwrapped.type) === HTML_CODE_BLOCK_TYPE;
}

/**
 * True for an HTML code block whose markup is still empty.
 *
 * Such a block renders nothing at all — its content sits behind the `ko if` that
 * data-ko-display generates — and `#main-edit-area .editable` has no min-height,
 * so without a placeholder the block is zero pixels tall and cannot be clicked.
 *
 * @param {Object} block
 * @returns {boolean}
 */
function isEmptyHtmlCodeBlock(block) {
  if (!isHtmlCodeBlock(block)) return false;
  const unwrapped = unwrap(block);
  const html = unwrap(unwrapped[HTML_CODE_PROPERTY]);
  return !html;
}

module.exports = { isHtmlCodeBlock, isEmptyHtmlCodeBlock };
