'use strict';

// How the spacing settings of a stored row are read (#1683): whatever is
// stored, what reaches the markup is whole px within the bounds, or nothing.

const {
  generate,
} = require('../../../packages/shared/block-builder/generate.js');
const {
  parseState,
  serialiseState,
} = require('../../../packages/shared/block-builder/state.js');
const {
  MAX_GUTTER,
  MAX_STACK_SPACING,
  normaliseGutter,
  normaliseGutters,
  normaliseStackSpacing,
} = require('../../../packages/shared/block-builder/row-spacing.js');
const {
  row,
  halves,
  thirds,
  composition,
  text,
  cellsOf,
} = require('./row-spacing-helpers.js');

const readRow = (stored) =>
  parseState(JSON.stringify({ v: 2, rows: [stored] })).rows[0];

describe('the gutters of a stored row', () => {
  it('are kept, with the widths between them', () => {
    expect(readRow(halves({ gutters: [20] }))).toMatchObject({
      gutters: [20],
    });
    expect(
      readRow(
        row(
          [
            [290, [text('a')]],
            [290, [text('b')]],
          ],
          { gutters: [20] }
        )
      ).columns.map((column) => column.width)
    ).toEqual([290, 290]);
  });

  it('give the columns equal shares of what they leave when the widths do not fit', () => {
    expect(
      readRow(halves({ gutters: [20] })).columns.map((column) => column.width)
    ).toEqual([290, 290]);
  });

  test.each([
    ['past the maximum', [55], [MAX_GUTTER]],
    ['a fraction', [12.6], [13]],
    ['one per interval, the extra dropped', [8, 16, 24], [8]],
  ])('are brought within the bounds: %s', (_label, stored, expected) => {
    expect(readRow(halves({ gutters: stored })).gutters).toEqual(expected);
  });

  it('are completed with 0 for an interval with nothing stored', () => {
    expect(readRow(thirds({ gutters: [10] })).gutters).toEqual([10, 0]);
  });

  test.each([
    ['negative', [-8]],
    ['zero', [0]],
    ['text', ['12']],
    ['markup', ['12px;}body{color:red']],
    ['null', [null]],
    ['an object', [{ px: 12 }]],
    ['not a list', 12],
  ])('are dropped when %s', (_label, stored) => {
    expect(readRow(halves({ gutters: stored }))).not.toHaveProperty('gutters');
  });

  it('are not read for a row of one column, which stays flat', () => {
    const read = parseState(
      JSON.stringify({
        v: 2,
        rows: [row([[600, [text('a')]]], { gutters: [20], stackSpacing: 12 })],
      })
    );

    expect(Object.keys(read.rows[0]).sort()).toEqual(['columns', 'id']);
    expect(JSON.parse(serialiseState(read)).v).toBe(1);
  });
});

describe('the stack spacing of a stored row', () => {
  test.each([
    ['on a step', 12, 12],
    ['between two steps', 13, 12],
    ['half a step up', 14, 16],
    ['past the maximum', 99, MAX_STACK_SPACING],
  ])('is read %s', (_label, stored, expected) => {
    expect(readRow(halves({ stackSpacing: stored })).stackSpacing).toBe(
      expected
    );
  });

  test.each([
    ['below half a step', 1],
    ['negative', -12],
    ['text', 'large'],
  ])('is dropped %s', (_label, stored) => {
    expect(readRow(halves({ stackSpacing: stored }))).not.toHaveProperty(
      'stackSpacing'
    );
  });
});

// Called directly: JSON has no NaN nor Infinity, it would store `null`.
describe('the normalisation', () => {
  test.each([
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['-Infinity', -Infinity],
  ])('makes %s nothing', (_label, value) => {
    expect(normaliseGutter(value)).toBe(0);
    expect(normaliseStackSpacing(value)).toBe(0);
    expect(normaliseGutters([value, value], 3)).toEqual([0, 0]);
  });

  it('gives a row of one column no gutter at all', () => {
    expect(normaliseGutters([20], 1)).toEqual([]);
  });
});

describe('the markup of a row with stored values it cannot trust', () => {
  it('holds none of them', () => {
    const html = generate(
      composition(
        halves({ gutters: ['12px;}body{', NaN], stackSpacing: '1;}' })
      )
    );

    expect(html).not.toContain('body{');
    cellsOf(html).forEach((cell) => expect(cell).not.toContain('padding'));
  });
});
