'use strict';

// A row holding no element, in any of its columns, is not part of the email:
// it renders nothing. It is therefore not written either — not stored, not
// counted when the shape is decided — so the preview, the applied markup and
// the state the server rebuilds from always agree.
//
// The case that matters most is the flat block: one with an empty row added
// below it (the user clicked "Add a row" and left it) must stay the block it
// was, stored as `v: 1`, its markup unchanged to the byte. The fixtures of
// flat-render-reference.test.js are that markup, produced before columns.

const {
  generate,
  emptyState,
} = require('../../../packages/shared/block-builder/generate.js');
const {
  parseState,
  serialiseState,
  isEmptyComposition,
} = require('../../../packages/shared/block-builder/state.js');
const {
  withoutEmptyRows,
  isFlatComposition,
  singleColumnRows,
} = require('../../../packages/shared/block-builder/composition.js');
const fixtures = require('./fixtures/flat-render-reference.json');

const text = (id, content) => ({ id, type: 'text', content });
const emptyRow = () => singleColumnRows()[0];
const row = (...columns) => ({
  id: singleColumnRows()[0].id,
  columns: columns.map(([width, elements]) => ({ width, elements })),
});
const composition = (rows) => ({ ...emptyState(), rows });
const stored = (state) => JSON.parse(serialiseState(state));

describe('withoutEmptyRows', () => {
  it('drops a row whose columns hold nothing', () => {
    const kept = row([100, [text('a', 'A')]]);

    expect(
      withoutEmptyRows([emptyRow(), kept, row([50, []], [50, []])])
    ).toEqual([kept]);
  });

  // The empty column is the space beside the content: it is the layout.
  it('keeps the empty columns of a row that holds something', () => {
    const halves = row([50, []], [50, [text('a', 'A')]]);

    expect(withoutEmptyRows([halves])).toEqual([halves]);
    expect(withoutEmptyRows([halves])[0].columns).toHaveLength(2);
  });

  it('reads anything that is not a list as no row', () => {
    expect(withoutEmptyRows(undefined)).toEqual([]);
    expect(withoutEmptyRows([null, { columns: 'x' }])).toEqual([]);
  });
});

describe('a flat block with an empty row added', () => {
  test.each(fixtures.map((fixture) => [fixture.name, fixture]))(
    '%s keeps its markup, byte for byte',
    (_name, fixture) => {
      const state = parseState(fixture.state);
      state.rows.push(emptyRow());
      state.rows.unshift(emptyRow());

      expect(isFlatComposition(state)).toBe(true);
      expect(generate(state, fixture.options)).toBe(fixture.html);
    }
  );

  it('is still stored as a flat list', () => {
    const state = composition([row([100, [text('a', 'A')]]), emptyRow()]);

    expect(stored(state)).toMatchObject({ v: 1, elements: [text('a', 'A')] });
    expect(stored(state).rows).toBeUndefined();
  });
});

describe('a composition of rows with an empty row', () => {
  const halves = () => row([50, [text('a', 'A')]], [50, []]);

  it('stores the rows that hold something, and only those', () => {
    const kept = halves();
    const state = composition([emptyRow(), kept, emptyRow()]);

    expect(stored(state).v).toBe(2);
    expect(stored(state).rows).toEqual([JSON.parse(JSON.stringify(kept))]);
  });

  it('renders as it reads back', () => {
    const state = composition([halves(), emptyRow()]);

    expect(generate(state)).toBe(generate(parseState(serialiseState(state))));
    expect(generate(state)).toBe(generate(composition([state.rows[0]])));
  });
});

describe('a composition whose rows all hold nothing', () => {
  it('is the empty composition it always was', () => {
    const state = composition([emptyRow(), row([50, []], [50, []])]);

    expect(serialiseState(state)).toBe(serialiseState(emptyState()));
    expect(isEmptyComposition(serialiseState(state))).toBe(true);
    expect(generate(state)).toBe('');
  });
});
