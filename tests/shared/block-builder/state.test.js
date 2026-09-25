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

describe('serialising the unserialisable', () => {
  it('stores nothing rather than half a state', () => {
    const cyclic = stateWith(textElement());
    cyclic.block.self = cyclic;

    expect(serialiseState(cyclic)).toBe('');
  });
});
