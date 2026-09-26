'use strict';

const ko = require('knockout');
const { SYNTHETIC_BLOCKS, descriptorForType } = require('./block-types.js');

// Predicates about a synthetic block, used by the view-model and the wysiwyg
// block template.
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
 * The descriptor of a block, or null when it is one of the template's own.
 *
 * @param {Object} block palette definition or block instance, wrapped or not
 * @returns {Object|null}
 */
function descriptorFor(block) {
  if (!block) return null;
  const unwrapped = unwrap(block);
  if (!unwrapped) return null;
  return descriptorForType(unwrap(unwrapped.type));
}

/**
 * True for either synthetic block — the pasted one and the composed one.
 *
 * @param {Object} block
 * @returns {boolean}
 */
function isSyntheticBlock(block) {
  return descriptorFor(block) !== null;
}

/**
 * True for a synthetic block whose markup is still empty.
 *
 * Such a block renders nothing at all — its content sits behind the `ko if` that
 * data-ko-display generates — and `#main-edit-area .editable` has no min-height,
 * so without a placeholder the block is zero pixels tall and cannot be clicked.
 *
 * @param {Object} block
 * @returns {boolean}
 */
function isEmptySyntheticBlock(block) {
  const descriptor = descriptorFor(block);
  if (!descriptor) return false;
  const unwrapped = unwrap(block);
  return !unwrap(unwrapped[descriptor.htmlProperty]);
}

/**
 * The i18n key of the placeholder to show in an empty synthetic block, or ''.
 *
 * Returned as a key rather than resolved here: this module is required by the
 * binding layer, which has no view-model and therefore no `t`.
 *
 * @param {Object} block
 * @returns {string}
 */
function emptyLabelKeyFor(block) {
  const descriptor = descriptorFor(block);
  return descriptor ? descriptor.emptyLabelKey : '';
}

/**
 * The i18n key of a synthetic block's palette entry, or ''.
 *
 * @param {Object} block
 * @returns {string}
 */
function paletteLabelKeyFor(block) {
  const descriptor = descriptorFor(block);
  return descriptor ? descriptor.paletteLabelKey : '';
}

/**
 * The palette icon class of a synthetic block, or ''.
 *
 * @param {Object} block
 * @returns {string}
 */
function paletteIconFor(block) {
  const descriptor = descriptorFor(block);
  return descriptor ? descriptor.paletteIcon : '';
}

/**
 * A predicate matching one specific synthetic block type.
 *
 * @param {Object} descriptor one of SYNTHETIC_BLOCKS
 * @returns {Function}
 */
function matching(descriptor) {
  return (block) => descriptorFor(block) === descriptor;
}

module.exports = {
  descriptorFor,
  isSyntheticBlock,
  isEmptySyntheticBlock,
  emptyLabelKeyFor,
  paletteLabelKeyFor,
  paletteIconFor,
  matching,
  SYNTHETIC_BLOCKS,
};
