'use strict';

const { textOf } = require('./exported-content');
const { normalizeMarkup } = require('./user-styles');

// A rich text is judged in the markup the client wrote, but its colours and
// sizes come partly from the template around it, only visible in the export.
// The export renders a rich text as the inner markup of the element the
// template binds it to (`data-ko-editable`, converter/parser.js), and that
// element keeps no marker of its own once exported (wysiwygId sets an id in
// the editor only): it is found by its content, the element of the block whose
// markup is the rich text's. Two identical rich texts of one block are matched
// in model order, which may differ from the template's.

// The elements of a block with their markup, serialised once per block: a
// block with several rich texts is not serialised again for each of them.
function markupsOf(ctx, blockId) {
  const maps = ctx.cache.blockMarkups || (ctx.cache.blockMarkups = {});
  if (!maps[blockId]) {
    const root = ctx.doc.getElementById(blockId);
    maps[blockId] = root
      ? Array.from(root.querySelectorAll('*')).map((el) => ({
          el,
          markup: normalizeMarkup(el.innerHTML),
        }))
      : [];
  }
  return maps[blockId];
}

/** The element of the export that holds a rich text, or null. */
function exportedRootOf(ctx, richText) {
  const cache =
    ctx.cache.exportedRoots || (ctx.cache.exportedRoots = new Map());
  if (!cache.has(richText)) {
    const wanted = normalizeMarkup(richText.root.innerHTML);
    const taken = ctx.cache.takenRoots || (ctx.cache.takenRoots = new Set());
    const found = wanted
      ? markupsOf(ctx, richText.blockId).find(
          ({ el, markup }) => !taken.has(el) && markup === wanted
        )
      : null;
    if (found) taken.add(found.el);
    cache.set(richText, found ? found.el : null);
  }
  return cache.get(richText);
}

// The deepest element showing each text of a block, built once per block: the
// fallback when the rich text is not found as a whole. Document order lists an
// ancestor before its descendants, so the last one with a text is the deepest.
function deepestByText(ctx, blockId) {
  const maps = ctx.cache.deepestByText || (ctx.cache.deepestByText = {});
  if (!maps[blockId]) {
    const map = new Map();
    const root = ctx.doc.getElementById(blockId);
    if (root) {
      Array.from(root.querySelectorAll('*')).forEach((el) =>
        map.set(textOf(el), el)
      );
    }
    maps[blockId] = map;
  }
  return maps[blockId];
}

/**
 * The exported counterpart of an element of a rich text: the element at the
 * same position in the exported markup (both trees are the same markup,
 * parsed), or else the deepest element of the block showing the same text.
 * @returns {Element|null}
 */
function exportedElementOf(ctx, richText, element) {
  const root = exportedRootOf(ctx, richText);
  if (root) {
    const index = Array.from(richText.root.querySelectorAll('*')).indexOf(
      element
    );
    return root.querySelectorAll('*')[index] || null;
  }
  return deepestByText(ctx, richText.blockId).get(textOf(element)) || null;
}

module.exports = { exportedRootOf, exportedElementOf };
