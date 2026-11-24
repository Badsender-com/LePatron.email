/**
 * Rows with spacing settings, and readers for their markup, shared by the
 * tests of the gutter and of the stack spacing (#1683).
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

/** A row of columns given as `[width, elements]`, with row settings. */
const row = (columns, settings) => ({
  id: 'row-a-1',
  columns: columns.map(([width, elements]) => ({ width, elements })),
  ...settings,
});
const halves = (settings) =>
  row(
    [
      [50, [text('a')]],
      [50, [text('b')]],
    ],
    settings
  );
const thirds = (settings) =>
  row(
    [
      [33, [image('a')]],
      [33, [image('b')]],
      [34, [image('c')]],
    ],
    settings
  );
const composition = (...rows) => ({ ...emptyState(), rows });

/** The opening tag of every cell of a row, in order. */
const cellsOf = (html) => html.match(/<td width="[^"]*"[^>]*>/g) || [];
const styleOf = (cell) => cell.match(/style="([^"]*)"/)[1];
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
  imageWidths,
};
