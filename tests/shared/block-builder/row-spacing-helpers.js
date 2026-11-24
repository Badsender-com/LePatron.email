/**
 * Rows with spacing settings, and readers for their markup, shared by the
 * tests of the gutters and of the stack spacing (#1683).
 *
 * Not a test file — no `.test.js`, so Jest's default match leaves it alone.
 */

'use strict';

const {
  emptyState,
} = require('../../../packages/shared/block-builder/generate.js');

const IMAGE = 'https://e.com/a.png';
const text = (id) => ({ id, type: 'text', content: id });
const image = (id) => ({ id, type: 'image', src: IMAGE });

/** A row of columns given as `[width in px, elements]`, with row settings. */
const row = (columns, settings) => ({
  id: 'row-a-1',
  columns: columns.map(([width, elements]) => ({ width, elements })),
  ...settings,
});
const halves = (settings) =>
  row(
    [
      [300, [text('a')]],
      [300, [text('b')]],
    ],
    settings
  );
const thirds = (settings) =>
  row(
    [
      [198, [image('a')]],
      [198, [image('b')]],
      [204, [image('c')]],
    ],
    settings
  );
const composition = (...rows) => ({ ...emptyState(), rows });

/** The opening tag of every cell of a row, in order. */
const cellsOf = (html) => html.match(/<td width="[^"]*"[^>]*>/g) || [];
const styleOf = (cell) => cell.match(/style="([^"]*)"/)[1];
const widthOf = (cell) => cell.match(/width="([^"]*)"/)[1];
const imageWidths = (html) =>
  (html.match(/<img [^>]*width="(\d+)"/g) || []).map((tag) =>
    Number(tag.match(/width="(\d+)"/)[1])
  );

module.exports = {
  row,
  halves,
  thirds,
  composition,
  text,
  image,
  cellsOf,
  styleOf,
  widthOf,
  imageWidths,
};
