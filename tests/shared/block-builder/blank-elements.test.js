'use strict';

// An element the user never filled is not sent.
//
// A new element starts blank: a text with no words, an image with no source,
// a button with no label. The modal draws a starter in each (STARTERS), so the
// block looked complete there — and the email got an empty black pill, an
// `<img src="">` and an empty paragraph cell. A blank element now renders
// nothing outside the preview: the slot that makes it something
// (`required` in components/*.slots.js) is what decides.

const {
  generate,
  emptyState,
} = require('../../../packages/shared/block-builder/generate.js');
const {
  singleColumnRows,
} = require('../../../packages/shared/block-builder/composition.js');
const {
  isBlankElement,
} = require('../../../packages/shared/block-builder/element-markup.js');
const {
  collectCss,
} = require('../../../packages/shared/block-builder/stylesheet.js');

const flat = (elements) => ({
  ...emptyState(),
  rows: singleColumnRows(elements),
});

const halves = (left, right) => ({
  ...emptyState(),
  rows: [
    {
      id: 'r1',
      columns: [
        { width: 300, elements: left },
        { width: 300, elements: right },
      ],
    },
  ],
});

const PREVIEW = {
  elementIds: true,
  chrome: true,
  starters: {
    text: { key: 'content', text: 'Saisissez votre texte…' },
    button: { key: 'label', text: 'Votre bouton' },
    image: { key: 'src' },
  },
};

describe('a blank element', () => {
  it.each([
    ['a text with no words', { id: 'a', type: 'text', content: '' }],
    [
      'a text the editor emptied',
      { id: 'a', type: 'text', content: '<p>&nbsp;</p>' },
    ],
    ['an image with no source', { id: 'a', type: 'image', src: '' }],
    ['a button with no label', { id: 'a', type: 'button', label: '  ' }],
  ])('is %s', (_name, element) => {
    expect(isBlankElement(element)).toBe(true);
  });

  it.each([
    ['a text', { id: 'a', type: 'text', content: 'Bonjour' }],
    ['an image', { id: 'a', type: 'image', src: 'https://example.test/a.png' }],
    ['a button', { id: 'a', type: 'button', label: 'Acheter' }],
    ['a divider', { id: 'a', type: 'divider' }],
    ['a spacer', { id: 'a', type: 'spacer' }],
  ])(
    'is never %s that holds something, nor a divider or a spacer',
    (_n, element) => {
      expect(isBlankElement(element)).toBe(false);
    }
  );

  it('is not sent', () => {
    const html = generate(
      flat([
        { id: 'a', type: 'text', content: 'Bonjour' },
        { id: 'b', type: 'image', src: '' },
        { id: 'c', type: 'button', label: '' },
      ])
    );

    expect(html).toContain('Bonjour');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<a ');
  });

  it('leaves nothing at all when the block holds nothing else', () => {
    expect(
      generate(
        flat([
          { id: 'a', type: 'text', content: '' },
          { id: 'b', type: 'button', label: '' },
        ])
      )
    ).toBe('');
  });

  it('leaves its column empty, so the row does not stack around it', () => {
    const state = halves(
      [{ id: 'a', type: 'text', content: 'Bonjour' }],
      [{ id: 'b', type: 'button', label: '' }]
    );

    expect(generate(state)).not.toContain('<a ');
    expect(collectCss(state)).toBe(
      collectCss(halves([{ id: 'a', type: 'text', content: 'Bonjour' }], []))
    );
  });

  // The preview still draws it, as its starter: it is where the user fills it.
  it('is still drawn in the preview', () => {
    const html = generate(
      flat([
        { id: 'a', type: 'text', content: 'Bonjour' },
        { id: 'b', type: 'button', label: '' },
      ]),
      PREVIEW
    );

    expect(html).toContain('Votre bouton');
  });
});
