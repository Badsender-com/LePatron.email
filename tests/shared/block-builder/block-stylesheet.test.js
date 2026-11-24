'use strict';

// The stylesheet a mailing's composed blocks need, from their stored states.
//
// Collected across blocks, so two blocks that stack are one rule; and
// remembered per state, because the canvas asks again on every change to the
// mailing and a stored state never changes in place.

// parseState counted, not replaced: the cache must keep reading through it.
jest.mock('../../../packages/shared/block-builder/state.js', () => {
  const actual = jest.requireActual(
    '../../../packages/shared/block-builder/state.js'
  );
  return { ...actual, parseState: jest.fn(actual.parseState) };
});

const text = (id) => ({ id, type: 'text', content: id });

// A stored state of one row of the given widths. `tag` only makes the string
// unique, so each test starts from states the cache has not seen.
const stored = (widths, tag = '') =>
  JSON.stringify({
    v: 2,
    gen: '1.0.0',
    rows: [
      {
        id: `r${tag}`,
        columns: widths.map((width, index) => ({
          width,
          elements: [text(`e${tag}-${index}`)],
        })),
      },
    ],
  });

let stylesheetForComposedBlocks;
let CACHE_LIMIT;
let parseState;

beforeEach(() => {
  // A fresh module each time, so the cache starts empty.
  jest.resetModules();
  ({
    stylesheetForComposedBlocks,
    CACHE_LIMIT,
  } = require('../../../packages/shared/block-builder/block-stylesheet.js'));
  ({ parseState } = require('../../../packages/shared/block-builder/state.js'));
});

describe('across several blocks', () => {
  it('holds one rule for two blocks that stack the same way', () => {
    const css = stylesheetForComposedBlocks([
      stored([50, 50], 'a'),
      stored([33, 33, 34], 'b'),
    ]);

    expect(css.match(/@media/g)).toHaveLength(1);
    expect(css.match(/\.lp-stack\{/g)).toHaveLength(1);
  });

  it('is the same as for one of them alone', () => {
    expect(
      stylesheetForComposedBlocks([stored([50, 50], 'a'), stored([50, 50])])
    ).toBe(stylesheetForComposedBlocks([stored([50, 50], 'c')]));
  });

  it('is nothing when no block has columns', () => {
    expect(stylesheetForComposedBlocks([stored([100], 'a')])).toBe('');
    expect(stylesheetForComposedBlocks([])).toBe('');
    expect(stylesheetForComposedBlocks(undefined)).toBe('');
  });

  // A state this version cannot read contributes nothing — and takes nothing
  // away from the blocks around it.
  test.each([
    ['not JSON', '{ not json'],
    ['a newer version', JSON.stringify({ v: 99, rows: [] })],
    ['not a string', { v: 2 }],
    ['nothing', undefined],
  ])('reads past a state that is %s', (_label, unreadable) => {
    const alone = stylesheetForComposedBlocks([stored([50, 50], 'x')]);

    expect(
      stylesheetForComposedBlocks([
        stored([100], 'y'),
        unreadable,
        stored([50, 50], 'x'),
      ])
    ).toBe(alone);
    expect(alone).not.toBe('');
  });
});

describe('remembered per stored state', () => {
  it('gives the same result the second time', () => {
    const states = [stored([50, 50], 'a'), stored([100], 'b')];

    const first = stylesheetForComposedBlocks(states);

    expect(stylesheetForComposedBlocks(states)).toBe(first);
  });

  it('does not read a state it has already read', () => {
    const states = [stored([50, 50], 'a'), stored([100], 'b')];
    stylesheetForComposedBlocks(states);
    parseState.mockClear();

    stylesheetForComposedBlocks(states);

    expect(parseState).not.toHaveBeenCalled();
  });

  it('reads a state it has not seen', () => {
    stylesheetForComposedBlocks([stored([50, 50], 'a')]);
    parseState.mockClear();

    stylesheetForComposedBlocks([stored([50, 50], 'a'), stored([100], 'b')]);

    expect(parseState).toHaveBeenCalledTimes(1);
  });

  it('remembers an unreadable state too', () => {
    stylesheetForComposedBlocks(['{ not json']);
    parseState.mockClear();

    expect(stylesheetForComposedBlocks(['{ not json'])).toBe('');
    expect(parseState).not.toHaveBeenCalled();
  });

  it('forgets the state used least recently once full', () => {
    const states = Array.from({ length: CACHE_LIMIT }, (_, index) =>
      stored([50, 50], `s${index}`)
    );
    stylesheetForComposedBlocks(states);
    // The first one, read again, is no longer the least recently used.
    stylesheetForComposedBlocks([states[0]]);

    stylesheetForComposedBlocks([stored([50, 50], 'one more')]);
    parseState.mockClear();

    stylesheetForComposedBlocks([states[0]]);
    expect(parseState).not.toHaveBeenCalled();
    stylesheetForComposedBlocks([states[1]]);
    expect(parseState).toHaveBeenCalledTimes(1);
  });
});
