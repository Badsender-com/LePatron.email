'use strict';

// A saved composed block is regenerated at insertion (ADR 0026), so the canvas
// shows from the start what the server will store. This is the shared half:
// a stored pair, brought to the current generator.
//
// The server already regenerates any composed block new to an email at its
// first save. Doing the same at insertion, with the same generator, is what
// makes that save find nothing to change.

const {
  generate,
  GENERATOR_VERSION,
} = require('../../../packages/shared/block-builder/generate.js');
const {
  serialiseState,
  parseState,
} = require('../../../packages/shared/block-builder/state.js');

const text = (id, content) => ({ id, type: 'text', content });

// A composition as an earlier generator stored it: its markup is whatever that
// generator wrote, and its version says so.
const storedByAnEarlierGenerator = (shape) => {
  const serialised = JSON.parse(serialiseState(shape));
  return JSON.stringify({ ...serialised, gen: '0.9.0' });
};

const ROWS = {
  v: 2,
  block: { backgroundColor: 'transparent', paddingTop: 0, paddingBottom: 0 },
  rows: [
    {
      id: 'row-1',
      columns: [
        { width: 50, elements: [text('a', 'gauche')] },
        { width: 50, elements: [text('b', 'droite')] },
      ],
    },
  ],
};

describe('a composition refreshed for insertion', () => {
  let refreshForInsertion;

  beforeAll(() => {
    // Required here, not at the top of the file: the module does not exist
    // until #1565 ships it.
    ({
      refreshForInsertion,
    } = require('../../../packages/shared/block-builder/refresh.js'));
  });

  it('regenerates the markup with the current generator', () => {
    const builderState = storedByAnEarlierGenerator(ROWS);

    const refreshed = refreshForInsertion({
      builderState,
      builderHtml: '<p>what an earlier generator wrote</p>',
    });

    expect(refreshed.builderHtml).toBe(generate(parseState(builderState)));
    expect(refreshed.builderHtml).toContain('gauche');
  });

  it('stamps the composition with the current generator', () => {
    const refreshed = refreshForInsertion({
      builderState: storedByAnEarlierGenerator(ROWS),
      builderHtml: '<p>old</p>',
    });

    expect(JSON.parse(refreshed.builderState).gen).toBe(GENERATOR_VERSION);
  });

  // The rule of #1223: a composition renders the way it was stored. Refreshing
  // brings the generator up to date, never the shape.
  it('keeps a row-shaped composition row-shaped', () => {
    const refreshed = refreshForInsertion({
      builderState: storedByAnEarlierGenerator(ROWS),
      builderHtml: '',
    });

    const stored = JSON.parse(refreshed.builderState);
    expect(Array.isArray(stored.rows)).toBe(true);
    expect(stored.elements).toBeUndefined();
  });

  it('keeps a flat composition flat', () => {
    const flat = JSON.stringify({
      v: 1,
      gen: '0.9.0',
      elements: [text('a', 'Bonjour')],
    });

    const refreshed = refreshForInsertion({
      builderState: flat,
      builderHtml: '',
    });

    const stored = JSON.parse(refreshed.builderState);
    expect(Array.isArray(stored.elements)).toBe(true);
    expect(stored.rows).toBeUndefined();
    expect(refreshed.builderHtml).toBe(generate(parseState(flat)));
  });

  // Nothing to rebuild from: the pair goes in as it is, and the server judges
  // it at the save as it always has.
  it.each([
    ['an unreadable composition', '{not json'],
    ['an empty composition', ''],
  ])('leaves %s as it is', (label, builderState) => {
    const pair = { builderState, builderHtml: '<p>stored</p>' };

    expect(refreshForInsertion(pair)).toEqual(pair);
  });
});
