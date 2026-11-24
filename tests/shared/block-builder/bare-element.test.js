'use strict';

// Rendering an element and wrapping it are now two decisions (#1205).
//
// They used to be one, and that was fine while every element was a row of a
// single-column block. Inside a column's cell the row is the wrong wrapper —
// a `<tr>` directly inside a `<td>` is invalid, and browsers drop it along
// with its content, so the element would simply vanish from the email.
//
// That a block stored flat still renders byte for byte as it did is pinned by
// flat-render-reference.test.js, against markup produced before the split.
// These tests pin the pieces.

const {
  generateElement,
  renderElement,
  elementAttributes,
  ELEMENT_ATTRIBUTE,
  STARTER_ATTRIBUTE,
} = require('../../../packages/shared/block-builder/generate.js');

const text = (overrides) => ({
  id: 'e1',
  type: 'text',
  content: 'Bonjour',
  ...overrides,
});

describe('renderElement', () => {
  it('renders the element with no row around it', () => {
    const markup = renderElement(text());

    expect(markup).toContain('Bonjour');
    expect(markup).not.toMatch(/^<tr\b/);
  });

  // Each element already renders a COMPLETE table of its own — rows and cells
  // included — which is what makes it droppable into a column cell at all: a
  // table inside a `<td>` is valid, a bare `<tr>` is not. What this ticket
  // removes is the row `generateElement` added AROUND that table.
  it('renders a self-contained element, not a loose row', () => {
    ['text', 'image', 'button', 'divider', 'spacer'].forEach((type) => {
      const markup = renderElement({ id: 'e1', type });

      expect(markup).not.toMatch(/^<tr\b/);
      expect(markup).toMatch(/^<(table|a|img|div)\b/);
    });
  });

  // The same rule as before the split: a type this version does not know comes
  // from a composition written by a newer one, and skipping it keeps the rest
  // of the block renderable instead of taking the canvas down.
  test.each([
    ['an unknown type', { id: 'e1', type: 'carousel' }],
    ['no type at all', { id: 'e1' }],
    ['not an object', 'nope'],
    ['null', null],
  ])('renders nothing for %s', (_label, element) => {
    expect(renderElement(element)).toBe('');
  });

  it('still substitutes a starter for a blank value', () => {
    const markup = renderElement(text({ content: '' }), {
      starters: { text: { key: 'content', text: 'Votre texte' } },
    });

    expect(markup).toContain('Votre texte');
  });
});

describe('elementAttributes', () => {
  // None of this belongs in a shipped email: it is what the preview uses to
  // know what was clicked and what is being dragged.
  it('is empty unless the preview asks', () => {
    expect(elementAttributes(text())).toBe('');
  });

  it('carries the element id when the preview asks', () => {
    expect(elementAttributes(text(), { elementIds: true })).toContain(
      `${ELEMENT_ATTRIBUTE}="e1"`
    );
  });

  it('marks an element showing a starter', () => {
    const attributes = elementAttributes(text({ content: '' }), {
      starters: { text: { key: 'content' } },
    });

    expect(attributes).toContain(`${STARTER_ATTRIBUTE}="text"`);
  });

  it('escapes an id it cannot trust', () => {
    const attributes = elementAttributes(text({ id: 'a"><script>' }), {
      elementIds: true,
    });

    expect(attributes).toBe(
      ` ${ELEMENT_ATTRIBUTE}="a&quot;&gt;&lt;script&gt;"`
    );
  });

  test.each([
    ['an unknown type', { id: 'e1', type: 'carousel' }],
    ['null', null],
  ])('is empty for %s', (_label, element) => {
    expect(elementAttributes(element, { elementIds: true })).toBe('');
  });
});

describe('generateElement', () => {
  // The rule for "nothing" is the type, never what was typed: a text left
  // empty is still an element, keeps its row, and is still there to select.
  it('keeps the row of a known element with nothing typed in it', () => {
    const html = generateElement(text({ content: '' }), { elementIds: true });

    expect(html).toMatch(
      new RegExp(`^<tr><td ${ELEMENT_ATTRIBUTE}="e1"><table`)
    );
    expect(html).toMatch(/<\/table><\/td><\/tr>$/);
  });

  test.each([
    ['an unknown type', { id: 'e1', type: 'carousel' }],
    ['null', null],
  ])('emits no row for %s', (_label, element) => {
    expect(generateElement(element)).toBe('');
  });
});
