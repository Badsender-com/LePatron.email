'use strict';

// What this pins, beyond "it renders": the generator must survive states it
// does not understand. A state is stored for years, read back by a newer
// version, and sometimes written by one. Throwing on an unknown element type
// would take the canvas — and the email — down with it.

const {
  generate,
  generateElement,
  emptyState,
  STATE_VERSION,
  ELEMENT_ATTRIBUTE,
} = require('../../../packages/shared/block-builder/generate.js');

const textElement = (overrides) => ({
  id: 'e1',
  type: 'text',
  content: 'Bonjour',
  ...overrides,
});

const stateWith = (...elements) => ({
  ...emptyState(),
  elements,
});

describe('emptyState', () => {
  it('records the schema version it was written with', () => {
    expect(emptyState().v).toBe(STATE_VERSION);
    expect(typeof emptyState().gen).toBe('string');
  });

  it('starts with no elements', () => {
    expect(emptyState().elements).toEqual([]);
  });
});

describe('generate', () => {
  it('renders each element in order', () => {
    const html = generate(
      stateWith(
        textElement({ id: 'a', content: 'First' }),
        textElement({ id: 'b', content: 'Second' })
      )
    );

    expect(html.indexOf('First')).toBeLessThan(html.indexOf('Second'));
  });

  it('tags each element so the canvas can find it', () => {
    const html = generate(stateWith(textElement({ id: 'e42' })));
    expect(html).toContain(`${ELEMENT_ATTRIBUTE}="e42"`);
  });

  it('paints the block background on the attribute and the style', () => {
    const state = stateWith(textElement());
    state.block = {
      backgroundColor: '#f6f6f6',
      paddingTop: 16,
      paddingBottom: 8,
    };

    const html = generate(state);

    expect(html).toContain('bgcolor="#f6f6f6"');
    expect(html).toContain('background-color:#f6f6f6');
    expect(html).toContain('padding:16px 0 8px 0');
  });

  it('fills an element from its defaults', () => {
    // No font size given: the text template's default must still land.
    const html = generate(stateWith({ id: 'a', type: 'text', content: 'x' }));
    expect(html).toContain('font-size:14px');
  });

  // Same rule as the HTML code block: an empty block ships nothing at all,
  // rather than an empty wrapper nobody can see or click.
  describe('exports nothing when there is nothing', () => {
    test.each([
      ['an empty state', emptyState()],
      ['no state', undefined],
      ['a state with no elements array', { v: 1 }],
      ['only unknown elements', stateWith({ id: 'a', type: 'nope' })],
    ])('%s', (_label, state) => {
      expect(generate(state)).toBe('');
    });
  });

  describe('survives a state it does not understand', () => {
    it('skips an unknown element type and renders the rest', () => {
      const html = generate(
        stateWith(
          { id: 'a', type: 'from-the-future' },
          textElement({ id: 'b', content: 'Still here' })
        )
      );

      expect(html).toContain('Still here');
    });

    test.each([
      ['null', null],
      ['a string', 'nope'],
      ['a number', 42],
    ])('skips %s in the elements array', (_label, element) => {
      expect(() => generate(stateWith(element, textElement()))).not.toThrow();
      expect(generate(stateWith(element, textElement()))).toContain('Bonjour');
    });

    it('does not let a prototype key masquerade as a type', () => {
      expect(generate(stateWith({ id: 'a', type: 'constructor' }))).toBe('');
    });
  });

  it('escapes a hostile element id', () => {
    const html = generate(
      stateWith(textElement({ id: '"><script>x</script>' }))
    );

    expect(html).not.toContain('<script>');
    expect(html).toContain('&quot;');
  });
});

describe('generateElement', () => {
  it('renders one element on its own, for a targeted canvas patch', () => {
    const html = generateElement(textElement({ content: 'Solo' }));

    expect(html).toContain('Solo');
    expect(html).toContain(ELEMENT_ATTRIBUTE);
  });

  test.each([
    ['null', null],
    ['an unknown type', { type: 'nope' }],
  ])('returns nothing for %s', (_label, element) => {
    expect(generateElement(element)).toBe('');
  });
});
