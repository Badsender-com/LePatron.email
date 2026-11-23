'use strict';

/**
 * What block translation extracts from a block (utils/block-content-extractor.js).
 * The listing of a block's text fields (ext/block-text-fields.js) reads it too,
 * and asks for more through `accept`: translation's own result stays as is.
 */

const {
  extractBlockTranslatableContent,
  isStyleValue,
} = require('../../packages/editor/src/js/utils/block-content-extractor');

const BLOCK = {
  id: 'ko_textBlock_1',
  type: 'textBlock',
  titleText: 'Les soldes',
  longText: '<p>Bonjour @[prenom]</p>',
  caption: '@[prenom]',
  heading: 'https://example.com',
  subTitle: 'contact@example.com',
  buttonText: '#fafafa',
  label: '12px',
  backgroundColor: '#ffffff',
  buttonLink: { text: 'BUTTON', url: 'https://example.com' },
  items: ['Livraison offerte', 'https://example.com', { text: 'Retours' }],
};

describe('extractBlockTranslatableContent', () => {
  it('extracts the texts translation translates, strings of a list included', () => {
    expect(extractBlockTranslatableContent(BLOCK)).toEqual({
      titleText: 'Les soldes',
      longText: '<p>Bonjour @[prenom]</p>',
      'buttonLink.text': 'BUTTON',
      'items.0': 'Livraison offerte',
      'items.2.text': 'Retours',
    });
  });

  it('extracts the values of named text fields `accept` keeps, a list’s strings still as translation judges them', () => {
    const extracted = extractBlockTranslatableContent(BLOCK, {
      accept: (value) => !isStyleValue(value),
    });
    expect(extracted).toEqual({
      titleText: 'Les soldes',
      longText: '<p>Bonjour @[prenom]</p>',
      caption: '@[prenom]',
      heading: 'https://example.com',
      subTitle: 'contact@example.com',
      'buttonLink.text': 'BUTTON',
      'items.0': 'Livraison offerte',
      'items.2.text': 'Retours',
    });
  });

  it('extracts nothing from what is not a block', () => {
    expect(extractBlockTranslatableContent(null)).toEqual({});
    expect(extractBlockTranslatableContent('text')).toEqual({});
  });
});

describe('isStyleValue', () => {
  it.each([
    '#fff',
    '#fafafa',
    'rgba(0, 0, 0, 0.5)',
    'transparent',
    '12px',
    '1.5em',
    '50%',
    '20',
  ])('calls %s a style value', (value) => {
    expect(isStyleValue(value)).toBe(true);
  });

  it.each([
    'Les soldes',
    '@[prenom]',
    'https://example.com',
    '12 px de marge',
    null,
  ])('calls %s no style value', (value) => {
    expect(isStyleValue(value)).toBe(false);
  });
});
