'use strict';

/**
 * The text fields of a block (ext/block-text-fields.js, #1253): one listing,
 * read by quality control's sample text rule and by the spelling correction
 * (epic #1251). A text field is what block translation already translates.
 */

const {
  listTextFields,
} = require('../../packages/editor/src/js/ext/block-text-fields');

const BLOCK = {
  id: 'ko_textBlock_3',
  type: 'textBlock',
  titleText: 'Les soldes commencent',
  longText: '<p>Profitez de <strong>-30 %</strong></p>',
  buttonText: 'Je choisis',
  buttonLink: 'https://example.com',
  backgroundColor: '#ffffff',
  image: { src: 'https://example.com/a.png', alt: 'Une robe en lin' },
  items: [{ text: 'Livraison offerte' }],
};

const paths = (fields) => fields.map((field) => field.path);

describe('the text fields of a block', () => {
  it('lists the text fields with their paths, alternative texts and list items included', () => {
    expect(paths(listTextFields(BLOCK))).toEqual([
      'titleText',
      'longText',
      'buttonText',
      'image.alt',
      'items.0.text',
    ]);
  });

  it('leaves out colours, links and anything that is not text', () => {
    const listed = paths(listTextFields(BLOCK));
    expect(listed).not.toContain('backgroundColor');
    expect(listed).not.toContain('buttonLink');
    expect(listed).not.toContain('image.src');
  });

  it('gives each field its value and its role', () => {
    expect(listTextFields(BLOCK)).toEqual([
      expect.objectContaining({
        path: 'titleText',
        role: 'title',
        value: 'Les soldes commencent',
      }),
      expect.objectContaining({ path: 'longText', role: 'text' }),
      expect.objectContaining({ path: 'buttonText', role: 'button' }),
      expect.objectContaining({
        path: 'image.alt',
        role: 'alt',
        value: 'Une robe en lin',
      }),
      expect.objectContaining({ path: 'items.0.text', role: 'text' }),
    ]);
  });

  it('flags a field still holding the template’s sample text', () => {
    const blockDef = { titleText: 'Titre', buttonText: 'Je choisis' };
    const sample = listTextFields(BLOCK, { blockDef })
      .filter((field) => field.sample)
      .map((field) => field.path);
    expect(sample).toEqual(['buttonText']);
  });

  it('flags a field the rendering hides, as the caller sees it', () => {
    const hidden = listTextFields(BLOCK, {
      isHidden: (path) => path === 'longText',
    })
      .filter((field) => field.hidden)
      .map((field) => field.path);
    expect(hidden).toEqual(['longText']);
  });

  it('flags nothing without a block definition nor a rendering', () => {
    expect(
      listTextFields(BLOCK).every((field) => !field.sample && !field.hidden)
    ).toBe(true);
  });
});
