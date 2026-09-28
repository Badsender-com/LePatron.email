/**
 * @jest-environment jsdom
 */

'use strict';

const {
  runQualityChecks,
} = require('../../../packages/editor/src/js/ext/quality/engine.js');
const { fakeViewModel, exportOf } = require('./fake-view-model');

const RULES = '../../../packages/editor/src/js/ext/quality/rules';
const unfilledLinks = require(`${RULES}/unfilled-links`);
const malformedLinks = require(`${RULES}/malformed-links`);
const displayedUrls = require(`${RULES}/displayed-urls`);
const suspiciousLinks = require(`${RULES}/suspicious-links`);
const insecureUrls = require(`${RULES}/insecure-urls`);

const blocks = [{ id: 'b1', type: 'textBlock' }];

// The findings of one rule on links placed in a block of the client.
function linkFindings(rule, anchors, { frame } = {}) {
  const html = exportOf({ b1: anchors }, { frame });
  return runQualityChecks(fakeViewModel({ blocks, html }), { rules: [rule] })
    .findings;
}
const a = (href, text = 'Go') => `<a href="${href}">${text}</a>`;

describe('unfilled-links', () => {
  it('reports a javascript: link, which email clients never run', () => {
    expect(linkFindings(unfilledLinks, a('javascript:void(0)'))).toHaveLength(
      1
    );
  });
});

describe('malformed-links', () => {
  const keyOf = (href) =>
    (linkFindings(malformedLinks, a(href))[0] || {}).messageKey;

  it.each([
    ['https://brand.com/a b', 'Link URL contains a space: __url__'],
    ['www.brand.com', 'Link URL misses http:// or https://: __url__'],
    ['brand.com/offer', 'Link URL misses http:// or https://: __url__'],
    ['/offer', 'Link URL is not a full address: __url__'],
    ['htps://brand.com', 'Link URL has an unknown protocol: __url__'],
    ['mailto:contact', 'Email link has no valid address: __url__'],
    ['tel:call-us', 'Phone link has no valid number: __url__'],
    ['https://brand', 'Link URL is not a full address: __url__'],
  ])('reports %s', (href, messageKey) => {
    expect(keyOf(href)).toBe(messageKey);
  });

  it.each([
    'https://brand.com/offer?utm_source=news',
    'mailto:contact@brand.com?subject=Hi',
    'tel:+33 1 23 45 67 89',
    '#top',
    '{{unsubscribe_url}}',
    '%%view_online%%',
    '[unsubscribe_link]',
    '#toreplace',
    'https://brand.com/%',
  ])('leaves %s alone', (href) => {
    expect(linkFindings(malformedLinks, a(href))).toEqual([]);
  });
});

describe('displayed-urls', () => {
  it.each(['www.brand.com', 'https://brand.com/offer', 'brand.fr'])(
    'warns when the link text is the address %s',
    (text) => {
      const findings = linkFindings(
        displayedUrls,
        a('https://brand.com', text)
      );
      expect(findings).toHaveLength(1);
      expect(findings[0].params.label).toBe(text);
    }
  );

  it('leaves a worded link alone', () => {
    expect(
      linkFindings(displayedUrls, a('https://brand.com', 'Discover the offer'))
    ).toEqual([]);
  });
});

describe('suspicious-links', () => {
  const keyOf = (href) =>
    (linkFindings(suspiciousLinks, a(href))[0] || {}).messageKey;

  it.each([
    ['https://bit.ly/abc', 'Public URL shortener: __host__'],
    [
      'https://brand.zip/offer',
      'Domain extension often used for spam: __host__',
    ],
    [
      'http://192.168.1.10/offer',
      'Link points to an IP address instead of a domain: __host__',
    ],
    [
      'https://user@brand.com',
      'Link address hides an identity before its domain: __host__',
    ],
    [
      'https://preprod.brand.com',
      'Link points to a test environment: __host__',
    ],
    [
      'http://localhost:3000/offer',
      'Link points to a test environment: __host__',
    ],
    ['https://www.example.com', 'Link points to an example domain: __host__'],
    [
      'https://xn--brnd-6qa.com',
      'Internationalized domain, check it is the expected one: __host__',
    ],
  ])('reports %s', (href, messageKey) => {
    expect(keyOf(href)).toBe(messageKey);
  });

  it.each([
    'https://www.brand.com',
    'https://brand.dev/docs',
    'https://test.fr',
    'https://links.brand.com/r/abc',
  ])('leaves %s alone', (href) => {
    expect(linkFindings(suspiciousLinks, a(href))).toEqual([]);
  });
});

describe('insecure-urls', () => {
  it('notes an http link and warns about an http image', () => {
    const findings = linkFindings(
      insecureUrls,
      `${a('http://brand.com')}<img src="http://cdn.brand.com/a.jpg">`
    );
    expect(findings.map((f) => f.severity)).toEqual(['info', 'warning']);
  });

  it("never judges the template's frame", () => {
    expect(
      linkFindings(insecureUrls, '', { frame: a('http://brand.com') })
    ).toEqual([]);
  });
});
