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

describe('isEmptyComposition', () => {
  it('recognises what the editor stores for an emptied block', () => {
    expect(isEmptyComposition(serialiseState(emptyState()))).toBe(true);
  });

  it.each([
    [
      'a composition with elements',
      serialiseState({
        ...emptyState(),
        elements: [{ id: 'a', type: 'text' }],
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
  ])('is false for %s', (_label, value) => {
    expect(isEmptyComposition(value)).toBe(false);
  });
});
