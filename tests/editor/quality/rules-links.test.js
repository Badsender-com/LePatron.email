/**
 * @jest-environment jsdom
 */

'use strict';

const {
  runQualityChecks,
} = require('../../../packages/editor/src/js/ext/quality/engine.js');
const {
  findUnfilledAnchors,
} = require('../../../packages/editor/src/js/ext/quality/links.js');
const { fakeViewModel, exportOf, findingsOf } = require('./fake-view-model');

const RULES = '../../../packages/editor/src/js/ext/quality/rules';
const unfilledLinks = require(`${RULES}/unfilled-links`);
const imagesWithoutLink = require(`${RULES}/images-without-link`);

describe('unfilled-links', () => {
  const blocks = [{ id: 'b1', type: 'textBlock' }];

  it('reports a link of a block still on #toreplace, with its label', () => {
    const html = exportOf({ b1: '<a href="#toreplace"> Shop  now </a>' });
    const findings = findingsOf(unfilledLinks, { blocks, html });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      severity: 'error',
      blockId: 'b1',
      messageKey: 'Link not filled in: __label__',
      params: { label: 'Shop now' },
    });
  });

  it('reports empty and bare "#" links too', () => {
    const html = exportOf({ b1: '<a href="">a</a><a href="#">b</a>' });
    expect(findingsOf(unfilledLinks, { blocks, html })).toHaveLength(2);
  });

  it('leaves real links and anchors without href alone', () => {
    const html = exportOf({
      b1:
        '<a href="https://example.org">a</a><a href="mailto:a@b.c">b</a><a name="top">c</a>',
    });
    expect(findingsOf(unfilledLinks, { blocks, html })).toEqual([]);
  });

  it("never judges the template's frame, outside every block", () => {
    const html = exportOf({}, { frame: '<a href="#toreplace">Footer</a>' });
    expect(findingsOf(unfilledLinks, { blocks, html })).toEqual([]);
  });

  it('leaves a linked image to images-without-link', () => {
    const html = exportOf({ b1: '<a href="#toreplace"><img src="x.png"></a>' });
    expect(findingsOf(unfilledLinks, { blocks, html })).toEqual([]);
  });
});

describe('images-without-link', () => {
  it('reports an image whose link was never filled in', () => {
    const blocks = [{ id: 'b1', type: 'imageBlock' }];
    const html = exportOf({ b1: '<a href="#toreplace"><img src="x.png"></a>' });
    const findings = findingsOf(imagesWithoutLink, { blocks, html });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      severity: 'warning',
      blockId: 'b1',
      messageKey: 'Clickable image has no link',
    });
  });

  it('leaves an image never replaced to unreplaced-images', () => {
    const blocks = [{ id: 'b1', type: 'imageBlock' }];
    const html = exportOf({
      b1:
        '<a href="#toreplace"><img src="http://localhost:3000/api/images/placeholder/600x300.png"></a>',
    });
    expect(findingsOf(imagesWithoutLink, { blocks, html })).toEqual([]);
  });
});

describe('findUnfilledAnchors', () => {
  it('looks the anchors up once per run, for both link rules', () => {
    const seen = [];
    const reader = {
      id: 'reader',
      run: (ctx) => {
        seen.push(findUnfilledAnchors(ctx));
        return [];
      },
    };
    const html = exportOf({ b1: '<a href="#toreplace">a</a>' });
    const vm = fakeViewModel({
      blocks: [{ id: 'b1', type: 'textBlock' }],
      html,
    });
    runQualityChecks(vm, { rules: [reader, reader] });
    runQualityChecks(vm, { rules: [reader] });

    expect(seen[0]).toHaveLength(1);
    expect(seen[1]).toBe(seen[0]);
    expect(seen[2]).not.toBe(seen[0]);
  });
});
