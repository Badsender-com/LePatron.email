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

  // Element ids are editing chrome. What `generate` returns by default is what
  // gets stored and mailed, and an internal id in a recipient's inbox is noise
  // — the markup is substituted verbatim at the very end of the export, so
  // nothing downstream would ever strip it.
  it('ships no element id by default', () => {
    const html = generate(stateWith(textElement({ id: 'e42' })));
    expect(html).not.toContain(ELEMENT_ATTRIBUTE);
  });

  it('tags each element when the preview asks for it', () => {
    const html = generate(stateWith(textElement({ id: 'e42' })), {
      elementIds: true,
    });
    expect(html).toContain(`${ELEMENT_ATTRIBUTE}="e42"`);
  });

  // `.map(generateElement)` hands the index as a second argument, which is
  // exactly where the options go: every element after the first would take its
  // `elementIds` from a number.
  it('tags every element, not just the first', () => {
    const html = generate(
      stateWith(textElement({ id: 'a' }), textElement({ id: 'b' })),
      { elementIds: true }
    );

    expect(html).toContain(`${ELEMENT_ATTRIBUTE}="a"`);
    expect(html).toContain(`${ELEMENT_ATTRIBUTE}="b"`);
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
      stateWith(textElement({ id: '"><script>x</script>' })),
      { elementIds: true }
    );

    expect(html).not.toContain('<script>');
    expect(html).toContain('&quot;');
  });
});

describe('generateElement', () => {
  it('renders one element on its own, for a targeted canvas patch', () => {
    const html = generateElement(textElement({ content: 'Solo' }), {
      elementIds: true,
    });

    expect(html).toContain('Solo');
    expect(html).toContain(ELEMENT_ATTRIBUTE);
  });

  it('leaves the id out unless asked, like generate does', () => {
    expect(generateElement(textElement({ content: 'Solo' }))).not.toContain(
      ELEMENT_ATTRIBUTE
    );
  });

  test.each([
    ['null', null],
    ['an unknown type', { type: 'nope' }],
  ])('returns nothing for %s', (_label, element) => {
    expect(generateElement(element)).toBe('');
  });
});
