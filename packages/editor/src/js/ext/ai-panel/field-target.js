'use strict';

/**
 * The block field an AI action targets, from the element being edited
 * (ADR 0011).
 *
 * Mosaico gives each editable element the id `<blockId>_<path>`, the first dot
 * of the path turned into an underscore (converter/parser.js), under its
 * block's container `<blockId>` = `ko_<type>_<n>`. That id is the only trace of
 * the field, so it is matched against the block's text fields
 * (ext/block-text-fields.js): an underscore in a path cannot be mistaken for a
 * dot, and an id that two fields could have targets nothing.
 */

const { BLOCK_ID, idOfPath } = require('../block-element-ids');
const { targetOfBlock } = require('./targets');

// The container of the block an element is in, or null.
function blockElementOf(element) {
  let block = element;
  while (block && !BLOCK_ID.test(block.id || '')) block = block.parentElement;
  return block || null;
}

/**
 * The target of the block an element is in, for an element no field matches:
 * the block's own (ext/ai-panel/targets.js), so the block that holds the
 * preheader is the preheader's target, as when it is selected.
 * @param {Element} element
 * @returns {{ kind: 'block', blockId: string, blockType: string } | { kind: 'preheader' } | null}
 */
function blockTargetOf(element) {
  const block = element && blockElementOf(element);
  if (!block) return null;
  const blockType = BLOCK_ID.exec(block.id)[1];
  return targetOfBlock({ type: () => blockType, id: () => block.id });
}

/**
 * @param {Element} element the element being edited, or inside it
 * @param {{ pathsOf: (blockId: string) => string[] }} options the paths of the
 *   text fields of a block
 * @returns {{ kind: 'blockField', blockId: string, blockType: string, field: string } | null}
 */
function fieldTargetOf(element, { pathsOf }) {
  const editable = element && element.closest('[contenteditable]');
  if (!editable || !editable.id) return null;
  const block = blockElementOf(editable.parentElement);
  if (!block || !editable.id.startsWith(`${block.id}_`)) return null;

  const suffix = editable.id.slice(block.id.length + 1);
  const matches = pathsOf(block.id).filter((path) => idOfPath(path) === suffix);
  if (matches.length !== 1) return null;
  return {
    kind: 'blockField',
    blockId: block.id,
    blockType: BLOCK_ID.exec(block.id)[1],
    field: matches[0],
  };
}

module.exports = { fieldTargetOf, blockTargetOf };
