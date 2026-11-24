'use strict';

const { DROP_LINE_ID, DROP_LINE_HEIGHT } = require('./preview-surface.js');
const {
  ELEMENT_ATTRIBUTE,
} = require('../../../../../../shared/block-builder/generate.js');

// Where a drag would land among a list of nodes, and the line that says so in
// the preview.
//
// Shared by both drags of the preview (drag-surface.js) — an insertion from
// the palette and the move of an element — which differ only in what happens
// on drop, and in the move drawing no line where it would change nothing. The
// position rule is shared with the row list too (row-drag.js). Plain
// functions rather than mixin methods: none of this reads the component, only
// the nodes it is handed.

/**
 * Where something dropped at this height would go among `nodes`.
 *
 * Measured against each node's midpoint: above it the drop goes before, below
 * it after. Past the last node, at the end.
 *
 * @param {Element[]} nodes in document order
 * @param {number} clientY
 * @returns {number} a drop position, counted with every node in place
 */
function dropIndexAt(nodes, clientY) {
  for (let i = 0; i < nodes.length; i++) {
    const box = nodes[i].getBoundingClientRect();
    if (clientY < box.top + box.height / 2) return i;
  }
  return nodes.length;
}

/**
 * Whether moving something to this drop position leaves it where it is:
 * either edge of itself, just above it or just below it.
 *
 * @param {number} from where it sits, -1 when it is not among them
 * @param {number} index the drop position
 * @returns {boolean}
 */
const leavesInPlace = (from, index) =>
  from !== -1 && (index === from || index === from + 1);

function clearDropLine(doc) {
  const line = doc && doc.getElementById(DROP_LINE_ID);
  if (line) line.parentNode.removeChild(line);
}

function addDropLine(doc) {
  const line = doc.createElement('div');
  line.id = DROP_LINE_ID;
  line.setAttribute('aria-hidden', 'true');
  doc.body.appendChild(line);
  return line;
}

/**
 * Draws the insertion line where a target says the drop would land.
 *
 * One line for the whole preview, moved to the edge the drop would land on,
 * rather than a class on an element: drawn on the element, it paints under
 * its content — invisible across an image — and every dragover toggled
 * classes on every element.
 *
 * As wide as the column aimed at, so the line also says which column: across
 * the whole block, it said nothing a two-column drop could be read by. A flat
 * preview is one column as wide as the document, and the line spans it.
 *
 * `movingId`, during a move, is the element being moved. No line on either of
 * its own edges: dropped there it stays put, and a line would promise a move
 * the drop does not make.
 *
 * @param {Document} doc
 * @param {{elements: Element[], index: number, box: DOMRect|null}} target
 *   what dropTargetAt returned
 * @param {string|null} [movingId]
 */
function showDropLine(doc, target, movingId) {
  const { elements, index, box } = target;
  const from = movingId
    ? elements.findIndex(
        (element) => element.getAttribute(ELEMENT_ATTRIBUTE) === movingId
      )
    : -1;
  if (!elements.length || leavesInPlace(from, index)) {
    clearDropLine(doc);
    return;
  }
  const edge =
    index < elements.length
      ? elements[index].getBoundingClientRect().top
      : elements[elements.length - 1].getBoundingClientRect().bottom;
  const view = doc.defaultView;
  const scrolledY = (view && view.pageYOffset) || 0;
  const scrolledX = (view && view.pageXOffset) || 0;
  const line = doc.getElementById(DROP_LINE_ID) || addDropLine(doc);
  // Centred on the edge, and kept inside the document at the top.
  const top = Math.max(0, Math.round(edge + scrolledY - DROP_LINE_HEIGHT / 2));
  line.style.top = `${top}px`;
  // Bounded to the column; back to the stylesheet's full width without one.
  line.style.left = box ? `${Math.round(box.left + scrolledX)}px` : '';
  line.style.width = box ? `${Math.round(box.width)}px` : '';
  line.style.right = box ? 'auto' : '';
}

module.exports = { dropIndexAt, leavesInPlace, showDropLine, clearDropLine };
