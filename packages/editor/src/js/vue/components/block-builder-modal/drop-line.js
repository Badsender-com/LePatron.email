'use strict';

const { DROP_LINE_ID, DROP_LINE_HEIGHT } = require('./preview-surface.js');

// Where a drag would land in the preview, and the line that says so.
//
// Shared by both drags (drag-surface.js) — an insertion from the palette and a
// reorder of a row — which differ only in what happens on drop. Plain
// functions rather than mixin methods: none of this reads the component, only
// the preview document and its rows, as `previewRows` hands them over.

/**
 * Where an element dropped at this height would go.
 *
 * Measured against each row's midpoint: above it the element goes before,
 * below it after. Past the last row, at the end.
 *
 * @param {Element[]} rows the preview's rows, in document order
 * @param {number} clientY
 * @returns {number} an index in `state.elements`
 */
function dropIndexAt(rows, clientY) {
  for (let i = 0; i < rows.length; i++) {
    const box = rows[i].getBoundingClientRect();
    if (clientY < box.top + box.height / 2) return i;
  }
  return rows.length;
}

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

// One line for the whole preview, moved to the edge the drop would land on,
// rather than a class on the row: drawn on the row, it paints under the row's
// content — invisible across an image — and every dragover toggled classes on
// every row.
function showDropLine(doc, rows, index) {
  if (!rows.length) {
    clearDropLine(doc);
    return;
  }
  const edge =
    index < rows.length
      ? rows[index].getBoundingClientRect().top
      : rows[rows.length - 1].getBoundingClientRect().bottom;
  const scrolled = (doc.defaultView && doc.defaultView.pageYOffset) || 0;
  const line = doc.getElementById(DROP_LINE_ID) || addDropLine(doc);
  // Centred on the edge, and kept inside the document at the top.
  const top = Math.max(0, Math.round(edge + scrolled - DROP_LINE_HEIGHT / 2));
  line.style.top = `${top}px`;
}

module.exports = { dropIndexAt, showDropLine, clearDropLine };
