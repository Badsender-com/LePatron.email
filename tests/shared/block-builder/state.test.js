'use strict';

// The stored state is read back from a database months later, written by a
// version that no longer exists, sometimes hand-edited. Every test here is a
// variant of "what if it is not what we wrote" — because returning null costs a
// user one composition, and throwing costs them the editor.

const {
  serialiseState,
  parseState,
  cleanElement,
} = require('../../../packages/shared/block-builder/state.js');
const {
  emptyState,
  STATE_VERSION,
  GENERATOR_VERSION,
} = require('../../../packages/shared/block-builder/generate.js');

const stateWith = (...elements) => ({ ...emptyState(), elements });
const textElement = (overrides) => ({
  id: 'a',
  type: 'text',
  content: 'Bonjour',
  ...overrides,
});

describe('a round trip', () => {
  it('comes back with the same elements', () => {
    const state = stateWith(textElement(), {
      id: 'b',
      type: 'spacer',
      height: 40,
    });

    const back = parseState(serialiseState(state));

    expect(back.elements).toHaveLength(2);
    expect(back.elements[0].content).toBe('Bonjour');
    expect(back.elements[1].height).toBe(40);
  });

  it('comes back with the block settings', () => {
    const state = stateWith(textElement());
    state.block = {
      backgroundColor: '#f6f6f6',
      paddingTop: 32,
      paddingBottom: 8,
    };

    expect(parseState(serialiseState(state)).block).toMatchObject({
      backgroundColor: '#f6f6f6',
      paddingTop: 32,
    });
  });

  it('stamps the schema version it was written with', () => {
    expect(JSON.parse(serialiseState(stateWith(textElement()))).v).toBe(
      STATE_VERSION
    );
  });
});

describe('nothing to reopen', () => {
  test.each([
    ['undefined', undefined],
    ['null', null],
    ['an empty string', ''],
    ['whitespace', '   '],
    ['a number', 42],
    ['broken JSON', '{"elements":'],
    ['JSON that is not an object', '"a string"'],
    ['an object with no elements', '{"v":1}'],
    ['elements that is not an array', '{"v":1,"elements":{}}'],
    ['an empty element list', '{"v":1,"elements":[]}'],
    [
      'only unknown element types',
      '{"v":1,"elements":[{"id":"a","type":"nope"}]}',
    ],
  ])('returns null for %s', (_label, stored) => {
    expect(parseState(stored)).toBeNull();
  });

  // Reopening a future state would silently rewrite the block with whatever
  // this version understands of it, and the next save would make that the truth.
  it('refuses a state from a newer version', () => {
    const future = JSON.stringify({
      v: STATE_VERSION + 1,
      elements: [textElement()],
    });

    expect(parseState(future)).toBeNull();
  });

  it('accepts a state with no version, from before versions were stamped', () => {
    const old = JSON.stringify({ elements: [textElement()] });

    expect(parseState(old)).not.toBeNull();
  });
});

describe('cleaning what comes back', () => {
  it('drops an element whose type no longer exists', () => {
    const stored = JSON.stringify({
      v: 1,
      elements: [{ id: 'a', type: 'gone' }, textElement({ id: 'b' })],
    });

    const back = parseState(stored);

    expect(back.elements).toHaveLength(1);
    expect(back.elements[0].id).toBe('b');
  });

  // Settings from a newer version would ride along invisibly and be written
  // back on the next save.
  it('drops a setting the element does not declare', () => {
    const stored = JSON.stringify({
      v: 1,
      elements: [textElement({ somethingNew: 'from the future' })],
    });

    expect(parseState(stored).elements[0].somethingNew).toBeUndefined();
  });

  it('fills a setting the stored element is missing', () => {
    const stored = JSON.stringify({
      v: 1,
      elements: [{ id: 'a', type: 'text' }],
    });

    // The template default, not undefined.
    expect(parseState(stored).elements[0].fontSize).toBe(14);
  });

  test.each([
    ['null', null],
    ['a string', 'nope'],
    ['no type', { id: 'a' }],
  ])('rejects %s as an element', (_label, element) => {
    expect(cleanElement(element)).toBeNull();
  });
});

// What the generator stamped is what tells a reopened block that applying
// would rebuild it differently. Overwriting it on the way in erased exactly that.
describe('the generator version', () => {
  it('keeps the one the stored state was written with', () => {
    const stored = JSON.stringify({
      v: 1,
      gen: '0.9.0',
      elements: [textElement()],
    });

    expect(parseState(stored).gen).toBe('0.9.0');
  });

  it('falls back to the current one when none was stored', () => {
    const stored = JSON.stringify({ v: 1, gen: 42, elements: [textElement()] });

    expect(parseState(stored).gen).toBe(GENERATOR_VERSION);
  });

  // Applying regenerates the markup with this version, so this is the version
  // that now produced what is stored.
  it('stamps the current one on the way out', () => {
    const state = { ...stateWith(textElement()), gen: '0.9.0' };

    expect(JSON.parse(serialiseState(state)).gen).toBe(GENERATOR_VERSION);
  });
});

describe('cleaning the block settings', () => {
  const blockOf = (block) =>
    parseState(JSON.stringify({ v: 1, block, elements: [textElement()] }))
      .block;

  it('drops a setting the block does not declare', () => {
    expect(blockOf({ paddingTop: 4, onload: 'x' })).toEqual({
      backgroundColor: 'transparent',
      paddingTop: 4,
      paddingBottom: 0,
    });
  });

  test.each([
    ['null', null],
    ['a string', 'nope'],
    ['an array', [1, 2]],
  ])('falls back to the defaults for %s', (_label, block) => {
    expect(blockOf(block)).toEqual(emptyState().block);
  });

  it('brings a value back to the type of its default', () => {
    expect(blockOf({ paddingTop: '12', paddingBottom: {} })).toMatchObject({
      paddingTop: 12,
      paddingBottom: 0,
    });
  });
});

describe('coercing element settings', () => {
  const buttonWith = (overrides) =>
    parseState(
      JSON.stringify({
        v: 1,
        elements: [{ id: 'a', type: 'button', ...overrides }],
      })
    ).elements[0];

  // The modal slices a button label for the element list: a number threw.
  it('turns a number where text is expected into text', () => {
    expect(buttonWith({ label: 42 }).label).toBe('42');
  });

  it('turns a numeric string where a number is expected into a number', () => {
    expect(buttonWith({ borderRadius: '8' }).borderRadius).toBe(8);
  });

  test.each([
    ['an object', { x: 1 }],
    ['null', null],
    ['an empty string', ''],
    ['not a number', 'eight'],
    ['infinity', 'Infinity'],
  ])('falls back to the default for %s', (_label, value) => {
    expect(buttonWith({ borderRadius: value, label: value }).borderRadius).toBe(
      4
    );
  });

  it('falls back to the default for text that is not text', () => {
    expect(buttonWith({ label: { x: 1 } }).label).toBe('');
    expect(buttonWith({ label: null }).label).toBe('');
  });
});

// The list, the selection and the preview all key on the id: two elements
// sharing one would select, move and render as one.
describe('element ids', () => {
  const idsOf = (elements) =>
    parseState(JSON.stringify({ v: 1, elements })).elements.map((e) => e.id);

  it('keeps distinct stored ids', () => {
    expect(
      idsOf([textElement({ id: 'a' }), textElement({ id: 'b' })])
    ).toEqual(['a', 'b']);
  });

  it('gives a missing id a fresh one', () => {
    const [id] = idsOf([textElement({ id: undefined })]);

    expect(typeof id).toBe('string');
    expect(id).not.toBe('');
  });

  it('gives a duplicated id a fresh one, keeping the first', () => {
    const ids = idsOf([textElement({ id: 'a' }), textElement({ id: 'a' })]);

    expect(ids[0]).toBe('a');
    expect(new Set(ids).size).toBe(2);
  });

  it('gives a non-string id a fresh one', () => {
    const [id] = idsOf([textElement({ id: { evil: true } })]);

    expect(typeof id).toBe('string');
  });
});

describe('serialising the unserialisable', () => {
  it('stores nothing rather than half a state', () => {
    const cyclic = stateWith(textElement());
    cyclic.block.self = cyclic;

    expect(serialiseState(cyclic)).toBe('');
  });
});
