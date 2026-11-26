'use strict';

// The limits of a stored composition, and what reading one makes of a value
// the editor would never have written.

const {
  parseState,
  readState,
  isEmptyComposition,
} = require('../../../packages/shared/block-builder/state.js');
const {
  MAX_ROWS,
  MAX_COLUMNS,
  areUsableWidths,
  newRowId,
} = require('../../../packages/shared/block-builder/composition.js');
const {
  BUILDER_STATE_MAX_LENGTH,
} = require('../../../packages/shared/synthetic-blocks.js');

const text = (id, content) => ({ id, type: 'text', content });
const rowOf = (widths, id) => ({
  ...(id === undefined ? {} : { id }),
  columns: widths.map((width, index) => ({
    width,
    elements: [text(`e${index}`, `colonne ${index}`)],
  })),
});
const read = (rows) => parseState(JSON.stringify({ v: 2, rows }));

describe('the number of rows', () => {
  it('reads up to MAX_ROWS rows', () => {
    const rows = Array.from({ length: MAX_ROWS }, () => rowOf([100]));

    expect(read(rows).rows).toHaveLength(MAX_ROWS);
  });

  it('refuses a composition of more rows, rather than folding them', () => {
    const rows = Array.from({ length: MAX_ROWS + 1 }, () => rowOf([100]));

    expect(MAX_ROWS).toBe(50);
    expect(read(rows)).toBeNull();
    expect(readState(JSON.stringify({ v: 2, rows }))).toEqual({
      state: null,
      empty: false,
    });
  });

  // Counted on what is stored: entries that are not rows still count, so a
  // state padded with them is refused without each one being looked at.
  it('refuses a state of empty rows up to its size bound', () => {
    const count = Math.floor((BUILDER_STATE_MAX_LENGTH - 20) / 3);
    const padded = `{"v":2,"rows":[${'{},'.repeat(count)}{}]}`;

    expect(padded.length).toBeGreaterThan(BUILDER_STATE_MAX_LENGTH * 0.99);
    expect(padded.length).toBeLessThanOrEqual(BUILDER_STATE_MAX_LENGTH);
    expect(parseState(padded)).toBeNull();
    expect(isEmptyComposition(padded)).toBe(false);
  });

  it('refuses as many entries that are not rows', () => {
    const rows = [rowOf([100]), ...Array.from({ length: MAX_ROWS }, () => 0)];

    expect(read(rows)).toBeNull();
  });
});

describe('an entry of rows that is not a row', () => {
  it.each([
    ['a number', 42],
    ['null', null],
    ['an array', [rowOf([100])]],
    ['a string', 'row'],
  ])('ignores %s instead of reading an empty row', (_label, entry) => {
    const state = read([entry, rowOf([100])]);

    expect(state.rows).toHaveLength(1);
    expect(state.rows[0].columns[0].elements[0].content).toBe('colonne 0');
  });
});

describe('row ids', () => {
  it('keeps an id in the shape the editor generates', () => {
    const id = newRowId();

    expect(read([rowOf([100], id)]).rows[0].id).toBe(id);
  });

  it.each([
    ['free text', 'r1'],
    ['markup', '<img src=x onerror=alert(1)>'],
    ['a generated id with something after it', `${newRowId()} x`],
    ['a number', 42],
  ])('replaces %s with a generated id', (_label, id) => {
    const [row] = read([rowOf([100], id)]).rows;

    expect(row.id).not.toBe(id);
    expect(row.id).toMatch(/^row-[0-9a-z]+-[0-9]+$/);
  });

  it('gives a duplicated row id a fresh one, keeping the first', () => {
    const id = newRowId();
    const { rows } = read([rowOf([100], id), rowOf([100], id)]);

    expect(rows[0].id).toBe(id);
    expect(rows[1].id).not.toBe(id);
    expect(rows[1].id).toMatch(/^row-/);
  });

  it('gives duplicated element ids across columns fresh ones', () => {
    const row = rowOf([50, 50]);
    row.columns[1].elements[0].id = row.columns[0].elements[0].id;

    const [left, right] = read([row]).rows[0].columns;

    expect(left.elements[0].id).toBe('e0');
    expect(right.elements[0].id).not.toBe('e0');
  });
});

describe('columns past the limit', () => {
  it('folds the fifth column’s elements into the fourth, in order', () => {
    const { columns } = read([rowOf([20, 20, 20, 20, 20])]).rows[0];

    expect(columns).toHaveLength(MAX_COLUMNS);
    expect(
      columns.map((column) => column.elements.map((element) => element.content))
    ).toEqual([
      ['colonne 0'],
      ['colonne 1'],
      ['colonne 2'],
      ['colonne 3', 'colonne 4'],
    ]);
  });
});

describe('widths read back', () => {
  const widthsOf = (widths, gutters) =>
    read([
      { ...rowOf(widths), ...(gutters ? { gutters } : {}) },
    ]).rows[0].columns.map((column) => column.width);

  it('keeps widths in px that fill the block', () => {
    expect(widthsOf([396, 204])).toEqual([396, 204]);
  });

  it('keeps widths in px that fill the block with the gutters', () => {
    expect(widthsOf([280, 280], [40])).toEqual([280, 280]);
  });

  // Written before px: whole percentages adding up to 100.
  it('reads widths in percent as px of the block', () => {
    expect(widthsOf([66, 34])).toEqual([396, 204]);
    expect(widthsOf([33, 33, 34])).toEqual([198, 198, 204]);
  });

  it.each([
    ['a width below the floor', [50, 550], [300, 300]],
    ['a percentage below the floor', [2, 98], [300, 300]],
    ['widths that do not fill the block', [200, 200, 199], [200, 200, 200]],
    ['percentages that do not add up', [33, 33, 33], [200, 200, 200]],
    ['a width that is not a number', ['wide', 50], [300, 300]],
    ['a width that is not whole', [300.5, 299.5], [300, 300]],
    ['a missing width', [undefined, undefined, undefined], [200, 200, 200]],
    ['four that overflow', [30, 30, 30, 30], [150, 150, 150, 150]],
  ])('falls back to equal shares for %s', (_label, widths, expected) => {
    expect(widthsOf(widths)).toEqual(expected);
  });

  it('shares what the gutters leave', () => {
    expect(widthsOf([100, 100], [20])).toEqual([290, 290]);
  });
});

describe('areUsableWidths', () => {
  it.each([
    [[600], []],
    [[300, 300], []],
    [[198, 198, 204], []],
    [[150, 150, 150, 150], []],
    [[60, 540], []],
    [[290, 290], [20]],
  ])('accepts %j between the gutters %j', (widths, gutters) => {
    expect(areUsableWidths(widths, gutters)).toBe(true);
  });

  it.each([
    ['widths that do not fill the block', [200, 200, 199], []],
    ['widths that ignore the gutters', [300, 300], [20]],
    ['percentages', [50, 50], []],
    ['NaN', [NaN, 600], []],
    ['infinity', [Infinity, 300], []],
    ['a fraction', [300.5, 299.5], []],
    ['a width below the minimum', [59, 541], []],
    ['more than four columns', [120, 120, 120, 120, 120], []],
    ['no column', [], []],
    ['not a list', '300,300', []],
  ])('refuses %s', (_label, widths, gutters) => {
    expect(areUsableWidths(widths, gutters)).toBe(false);
  });
});
