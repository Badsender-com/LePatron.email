/**
 * @jest-environment jsdom
 */

'use strict';

const {
  runQualityChecks,
} = require('../../../packages/editor/src/js/ext/quality/engine.js');
const { fakeViewModel, exportOf } = require('./fake-view-model');

const RULES = '../../../packages/editor/src/js/ext/quality/rules';
const unnamedImageLinks = require(`${RULES}/unnamed-image-links`);
const altTextQuality = require(`${RULES}/alt-text-quality`);
const imageOnlyEmail = require(`${RULES}/image-only-email`);
const unsupportedImageFormats = require(`${RULES}/unsupported-image-formats`);

const blocks = [{ id: 'b1', type: 'imageBlock' }];

function findingsIn(rule, blockHtml) {
  const html = exportOf({ b1: blockHtml });
  return runQualityChecks(fakeViewModel({ blocks, html }), { rules: [rule] })
    .findings;
}

describe('unnamed-image-links', () => {
  it('warns about a link made of an image without alternative text', () => {
    const findings = findingsIn(
      unnamedImageLinks,
      '<a href="https://brand.com"><img src="a.jpg" alt=""></a>'
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].category).toBe('accessibility');
  });

  it.each([
    '<a href="https://brand.com"><img src="a.jpg" alt="Spring sale"></a>',
    '<a href="https://brand.com" aria-label="Spring sale"><img src="a.jpg" alt=""></a>',
    '<a href="https://brand.com"><img src="a.jpg" alt="">Shop</a>',
    '<a href="#toreplace"><img src="a.jpg" alt=""></a>',
  ])('leaves a named or unfilled link alone: %s', (blockHtml) => {
    expect(findingsIn(unnamedImageLinks, blockHtml)).toEqual([]);
  });
});

describe('alt-text-quality', () => {
  const keyOf = (alt) =>
    (findingsIn(altTextQuality, `<img src="a.jpg" alt="${alt}">`)[0] || {})
      .messageKey;

  it.each([
    ['IMG_1234.jpg', 'Alternative text looks like a file name: __alt__'],
    ['banner-spring.png', 'Alternative text looks like a file name: __alt__'],
    ['https://brand.com/a.jpg', 'Alternative text is an address: __alt__'],
    [
      'a'.repeat(151),
      'Alternative text is too long (__count__ characters): keep it to a short description',
    ],
  ])('notes %s', (alt, messageKey) => {
    expect(keyOf(alt)).toBe(messageKey);
  });

  it('leaves a decorative image with an empty alt, and a real description, alone', () => {
    expect(keyOf('')).toBeUndefined();
    expect(keyOf('A woman holding the new serum')).toBeUndefined();
  });
});

describe('image-only-email', () => {
  it('warns when the images carry almost all the content', () => {
    const findings = findingsIn(imageOnlyEmail, '<img src="a.jpg"><p>Hi</p>');
    expect(findings).toHaveLength(1);
    expect(findings[0].params.count).toBe(2);
  });

  it('stays silent with real text, or without images', () => {
    const text = `<p>${'Our new collection is here. '.repeat(5)}</p>`;
    expect(findingsIn(imageOnlyEmail, `<img src="a.jpg">${text}`)).toEqual([]);
    expect(findingsIn(imageOnlyEmail, '<p>Hi</p>')).toEqual([]);
  });
});

describe('unsupported-image-formats', () => {
  it.each([
    ['https://cdn.brand.com/hero.webp', 'WEBP'],
    ['http://localhost:3000/api/images/cover/600x300/hero.avif', 'AVIF'],
    ['data:image/svg+xml;base64,PHN2Zz4=', 'SVG'],
  ])('warns about %s', (src, format) => {
    const findings = findingsIn(unsupportedImageFormats, `<img src="${src}">`);
    expect(findings).toHaveLength(1);
    expect(findings[0].params.format).toBe(format);
  });

  it.each(['a.jpg', 'a.PNG', 'https://cdn.brand.com/a.gif?v=2'])(
    'leaves %s alone',
    (src) => {
      expect(findingsIn(unsupportedImageFormats, `<img src="${src}">`)).toEqual(
        []
      );
    }
  );
});
