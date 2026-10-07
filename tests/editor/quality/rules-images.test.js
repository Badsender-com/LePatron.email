/**
 * @jest-environment jsdom
 */

'use strict';

const { exportOf, findingsOf } = require('./fake-view-model');

const RULES = '../../../packages/editor/src/js/ext/quality/rules';
const unreplacedImages = require(`${RULES}/unreplaced-images`);
const backgroundImages = require(`${RULES}/background-images`);

const PLACEHOLDER = '/upload?method=placeholder&params=600,300';

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

  it('still checks the other images when an src cannot be parsed', () => {
    const blocks = [{ id: 'b1', type: 'imageBlock' }];
    const html = exportOf({
      b1: `<img src="http://exa mple.com/x.png"><img src="${PLACEHOLDER}">`,
    });
    const findings = findingsOf(unreplacedImages, { blocks, html });

    expect(findings).toHaveLength(1);
    expect(findings[0].messageKey).toBe('Image not replaced');
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

  // LePatron's image backend re-serves the sample under its own route: only
  // the file name is left of the template's URL.
  it('recognises the sample image as LePatron exports it', () => {
    const blocks = [
      { id: 'b1', type: 'imageBlock', image: { ...imageBlockDef.image } },
    ];
    const html = exportOf({
      b1:
        '<img src="http://localhost:3000/api/images/cover/600x300/sample.jpg">',
    });
    const findings = findingsOf(unreplacedImages, {
      blocks,
      blockDefs: [imageBlockDef],
      html,
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
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

describe('background-images', () => {
  const heroDef = {
    type: 'heroBlock',
    bgOptions: {
      bgimage: 'https://cdn.test/bg-placeholder.png',
      outlookBgImage: '',
      mobileBgimage: '',
    },
  };
  const hero = (bgOptions) => ({ id: 'b1', type: 'heroBlock', bgOptions });

  it('reports each background variant turned on without an image', () => {
    const blocks = [
      hero({
        outlookBgImageVisible: true,
        outlookBgImage: '',
        mobileBgImageChoice: 'mobile',
        mobileBgimage: null,
        bgImageChoice: 'custom',
        bgimage: 'none',
      }),
    ];
    const findings = findingsOf(backgroundImages, {
      blocks,
      blockDefs: [heroDef],
    });

    expect(findings.map((f) => f.propertyPath)).toEqual([
      'bgOptions.outlookBgImage',
      'bgOptions.mobileBgimage',
      'bgOptions.bgimage',
    ]);
    expect(findings[0]).toMatchObject({
      severity: 'warning',
      blockId: 'b1',
      messageKey: 'Missing Outlook background image',
    });
  });

  it("counts the template's default image as not replaced", () => {
    const blocks = [
      hero({ bgImageVisible: true, bgimage: heroDef.bgOptions.bgimage }),
    ];
    const findings = findingsOf(backgroundImages, {
      blocks,
      blockDefs: [heroDef],
    });
    expect(findings).toHaveLength(1);
  });

  it('leaves filled images and variants turned off alone', () => {
    const blocks = [
      hero({
        outlookBgImageVisible: false,
        outlookBgImage: '',
        mobileBgImageChoice: 'desktop',
        mobileBgimage: '',
        bgImageChoice: 'custom',
        bgimage: 'https://cdn.test/mine.png',
      }),
    ];
    expect(
      findingsOf(backgroundImages, { blocks, blockDefs: [heroDef] })
    ).toEqual([]);
  });
});
