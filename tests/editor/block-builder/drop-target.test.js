/**
 * @jest-environment jsdom
 */

'use strict';

// Which column a point in the preview aims at (drop-target.js), on a document
// marked up the way the generator's chrome marks it, with boxes given by hand:
// jsdom lays nothing out.

const {
  dropTargetAt,
} = require('../../../packages/editor/src/js/vue/components/block-builder-modal/drop-target.js');
const { placeAt } = require('./drag-helpers.js');

const column = (rowId, index, ids) =>
  `<div class="lp-bb-col" data-lp-row="${rowId}" data-lp-col="${index}">` +
  ids.map((id) => `<div data-lp-el="${id}"></div>`).join('') +
  '</div>';

/**
 * Two rows. The first has a short column on the left — one element, 50px —
 * beside a tall one on the right, with a 20px gutter between their cells; the
 * second is one empty column.
 */
function twoRows() {
  document.body.innerHTML =
    '<table><tr>' +
    `<td id="left">${column('r1', 0, ['a'])}</td>` +
    `<td id="right">${column('r1', 1, ['b', 'c'])}</td>` +
    '</tr></table>' +
    `<table><tr><td id="below">${column('r2', 0, [])}</td></tr></table>`;

  const byId = (id) => document.getElementById(id);
  const el = (id) => document.querySelector(`[data-lp-el="${id}"]`);
  placeAt(byId('left'), { left: 0, width: 290, top: 0, height: 200 });
  placeAt(byId('right'), { left: 310, width: 290, top: 0, height: 200 });
  placeAt(byId('below'), { left: 0, width: 600, top: 200, height: 40 });
  // The chrome inside a cell is as tall as what it holds: the short column's
  // box stops at 50px, where its cell goes on to 200.
  placeAt(byId('left').firstChild, { left: 0, width: 290, top: 0, height: 50 });
  placeAt(byId('right').firstChild, {
    left: 310,
    width: 290,
    top: 0,
    height: 200,
  });
  placeAt(el('a'), { left: 0, width: 290, top: 0, height: 50 });
  placeAt(el('b'), { left: 310, width: 290, top: 0, height: 100 });
  placeAt(el('c'), { left: 310, width: 290, top: 100, height: 100 });
  return document;
}

/** The part of a target that names the place, without the nodes. */
const placeOf = (target) =>
  target && {
    rowId: target.rowId,
    columnIndex: target.columnIndex,
    index: target.index,
  };

describe('dropTargetAt', () => {
  it('aims at the column the point is inside, at the midpoint it passed', () => {
    const doc = twoRows();

    const target = dropTargetAt(doc, 450, 160);

    expect(placeOf(target)).toEqual({ rowId: 'r1', columnIndex: 1, index: 2 });
  });

  // The blank under a short column is that column, not its taller neighbour.
  it('aims at a short column from the blank under its content', () => {
    const doc = twoRows();

    const target = dropTargetAt(doc, 150, 150);

    expect(placeOf(target)).toEqual({ rowId: 'r1', columnIndex: 0, index: 1 });
  });

  it('aims at the nearer column from the gutter between two', () => {
    const doc = twoRows();

    expect(placeOf(dropTargetAt(doc, 295, 20)).columnIndex).toBe(0);
    expect(placeOf(dropTargetAt(doc, 306, 20)).columnIndex).toBe(1);
  });

  it('aims at the last row from below it, an empty column included', () => {
    const doc = twoRows();

    const target = dropTargetAt(doc, 100, 400);

    expect(placeOf(target)).toEqual({ rowId: 'r2', columnIndex: 0, index: 0 });
    expect(target.elements).toEqual([]);
  });

  // What the line and the marked column need comes with the answer, so the
  // dragover looks nothing up a second time.
  it('hands back the column, its elements and its cell box', () => {
    const doc = twoRows();

    const target = dropTargetAt(doc, 450, 20);

    expect(target.column).toBe(doc.querySelector('#right .lp-bb-col'));
    expect(target.elements.map((e) => e.getAttribute('data-lp-el'))).toEqual([
      'b',
      'c',
    ]);
    expect(target.box).toMatchObject({ left: 310, width: 290 });
  });

  it('reads a flat preview as one column, the width of the document', () => {
    document.body.innerHTML =
      '<table><tr><td data-lp-el="a"></td></tr>' +
      '<tr><td data-lp-el="b"></td></tr></table>';
    const [a, b] = document.querySelectorAll('[data-lp-el]');
    placeAt(a, { top: 0, height: 100 });
    placeAt(b, { top: 100, height: 100 });

    const target = dropTargetAt(document, 10, 120, 'row-flat');

    expect(placeOf(target)).toEqual({
      rowId: 'row-flat',
      columnIndex: 0,
      index: 1,
    });
    expect(target.column).toBe(document.body);
    expect(target.box).toBeNull();
  });

  it('aims at nothing when the preview has no column and is not flat', () => {
    document.body.innerHTML = '<div id="lp-bb-empty-drop"></div>';

    expect(dropTargetAt(document, 10, 10, null)).toBeNull();
    expect(dropTargetAt(null, 10, 10, 'row-flat')).toBeNull();
  });
});
