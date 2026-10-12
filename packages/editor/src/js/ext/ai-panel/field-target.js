'use strict';

/**
 * The block field an AI action targets, from the element being edited
 * (ADR 0005).
 *
 * Mosaico gives each editable element the id `<blockId>_<path>`, the first dot
 * of the path turned into an underscore (converter/parser.js), under its
 * block's container `<blockId>` = `ko_<type>_<n>`. That id is the only trace of
 * the field, so it is matched against the block's text fields
 * (ext/block-text-fields.js): an underscore in a path cannot be mistaken for a
 * dot, and an id that two fields could have targets nothing.
 */

const BLOCK_ID = /^ko_([A-Za-z][A-Za-z0-9]*)_(\d+)$/;

const idOfPath = (path) => path.replace('.', '_');

/**
 * @param {Element} element the element being edited, or inside it
 * @param {{ pathsOf: (blockId: string) => string[] }} options the paths of the
 *   text fields of a block
 * @returns {{ kind: 'blockField', blockId: string, blockType: string, field: string } | null}
 */
function fieldTargetOf(element, { pathsOf }) {
  const editable = element && element.closest('[contenteditable]');
  if (!editable || !editable.id) return null;
  let block = editable.parentElement;
  while (block && !BLOCK_ID.test(block.id || '')) block = block.parentElement;
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

module.exports = { fieldTargetOf };
