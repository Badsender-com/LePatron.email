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
const imagesWithoutLink = require(`${RULES}/images-without-link`);
const unreplacedImages = require(`${RULES}/unreplaced-images`);

const PLACEHOLDER = '/upload?method=placeholder&params=600,300';

function findingsOf(rule, vmOptions) {
  return runQualityChecks(fakeViewModel(vmOptions), { rules: [rule] }).findings;
}

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
});

describe('unreplaced-images', () => {
  const imageBlockDef = {
    type: 'imageBlock',
    image: { type: 'image', src: 'https://cdn.test/sample.jpg', url: '' },
  };

  it('reports the placeholder of an empty image, and an image without src', () => {
    const blocks = [{ id: 'b1', type: 'imageBlock', image: { src: '' } }];
    const html = exportOf({ b1: `<img src="${PLACEHOLDER}"><img alt="">` });
    const findings = findingsOf(unreplacedImages, { blocks, html });

    expect(findings).toHaveLength(2);
    expect(findings[0]).toMatchObject({
      severity: 'error',
      blockId: 'b1',
      messageKey: 'Image not replaced',
    });
  });

  it("reports LePatron's own placeholder route, as the editor exports it", () => {
    const blocks = [{ id: 'b1', type: 'textimageBlock' }];
    const html = exportOf({
      b1:
        '<img src="http://localhost:3000/api/images/placeholder/300x360.png" width="300">',
    });
    const findings = findingsOf(unreplacedImages, { blocks, html });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      blockId: 'b1',
      messageKey: 'Image not replaced',
    });
  });

  it('keeps real images of the image backend out of the placeholders', () => {
    const blocks = [{ id: 'b1', type: 'imageBlock' }];
    const html = exportOf({
      b1:
        '<img src="http://localhost:3000/api/images/cover/600x300/photo.jpg">',
    });
    expect(findingsOf(unreplacedImages, { blocks, html })).toEqual([]);
  });

  it('leaves the transparent GIF templates use as a spacer alone', () => {
    const blocks = [{ id: 'b1', type: 'spacerBlock' }];
    const gif =
      'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
    const html = exportOf({ b1: `<img src="${gif}" width="1" height="20">` });
    expect(findingsOf(unreplacedImages, { blocks, html })).toEqual([]);
  });

  it("never judges the template's own images, outside every block", () => {
    const html = exportOf({}, { frame: `<img src="${PLACEHOLDER}">` });
    expect(findingsOf(unreplacedImages, { html })).toEqual([]);
  });

  it("warns about the template's sample image still shown", () => {
    const blocks = [
      {
        id: 'b1',
        type: 'imageBlock',
        image: { type: 'image', src: 'https://cdn.test/sample.jpg', url: '' },
      },
    ];
    const html = exportOf({
      b1: '<img src="https://cdn.test/sample.jpg?method=resize&width=600">',
    });
    const findings = findingsOf(unreplacedImages, {
      blocks,
      blockDefs: [imageBlockDef],
      html,
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      severity: 'warning',
      messageKey: 'Template sample image not replaced',
      propertyPath: 'image.src',
    });
  });

  it('ignores a sample image the export does not show, or a replaced one', () => {
    const sample = {
      id: 'b1',
      type: 'imageBlock',
      image: { src: 'https://cdn.test/sample.jpg' },
    };
    const replaced = {
      id: 'b2',
      type: 'imageBlock',
      image: { src: 'https://cdn.test/mine.jpg' },
    };
    const html = exportOf({
      b1: '',
      b2: '<img src="https://cdn.test/mine.jpg?method=resize">',
    });

    expect(
      findingsOf(unreplacedImages, {
        blocks: [sample, replaced],
        blockDefs: [imageBlockDef],
        html,
      })
    ).toEqual([]);
  });
});
