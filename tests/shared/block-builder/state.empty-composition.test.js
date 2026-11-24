'use strict';

// parseState returns null both for a state it cannot read and for a
// composition without any element. The server must tell them apart: the first
// is refused rather than rebuilt into nothing, the second is an empty block
// the editor stores when every element was removed and applied.

const {
  serialiseState,
  isEmptyComposition,
} = require('../../../packages/shared/block-builder/state.js');
const {
  emptyState,
  STATE_VERSION,
} = require('../../../packages/shared/block-builder/generate.js');
const {
  singleColumnRows,
} = require('../../../packages/shared/block-builder/composition.js');

describe('isEmptyComposition', () => {
  it('recognises what the editor stores for an emptied block', () => {
    expect(isEmptyComposition(serialiseState(emptyState()))).toBe(true);
  });

  it.each([
    ['no rows', JSON.stringify({ v: 2, rows: [] })],
    [
      'rows of empty columns',
      JSON.stringify({
        v: 2,
        rows: [{ columns: [{ width: 50, elements: [] }, { width: 50 }] }],
      }),
    ],
  ])('is true for %s', (_label, value) => {
    expect(isEmptyComposition(value)).toBe(true);
  });

  it.each([
    [
      'a composition with elements',
      serialiseState({
        ...emptyState(),
        rows: singleColumnRows([{ id: 'a', type: 'text' }]),
      }),
    ],
    ['nothing stored', ''],
    ['corrupt JSON', '{"elements":['],
    ['another shape', '{"v":1}'],
    [
      'a future version',
      JSON.stringify({ v: STATE_VERSION + 1, elements: [] }),
    ],
    ['a value that is not a string', { elements: [] }],
    // Judged on what is stored, not on what reading it keeps.
    [
      'elements of an unknown type only',
      JSON.stringify({ v: 1, elements: [{ id: 'a', type: 'nope' }] }),
    ],
    ['an element that is null', JSON.stringify({ v: 1, elements: [null] })],
    [
      'a column holding anything',
      JSON.stringify({ v: 2, rows: [{ columns: [{ elements: [42] }] }] }),
    ],
    [
      'rows beside a non-empty flat list',
      JSON.stringify({ v: 2, rows: [], elements: [{ type: 'text' }] }),
    ],
  ])('is false for %s', (_label, value) => {
    expect(isEmptyComposition(value)).toBe(false);
  });
});
