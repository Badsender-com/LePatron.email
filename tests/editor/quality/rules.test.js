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
const backgroundImages = require(`${RULES}/background-images`);
const htmlSize = require(`${RULES}/html-size`);
const trackingParams = require(`${RULES}/tracking-params`);

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

describe('html-size', () => {
  it('warns above the 102 KB Gmail clipping limit, with the size', () => {
    const html = `<p>${'a'.repeat(110 * 1024)}</p>`;
    const findings = findingsOf(htmlSize, { html });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ severity: 'warning', blockId: null });
    expect(findings[0].params.size).toBeGreaterThan(102);
  });

  it('stays silent below the limit', () => {
    expect(findingsOf(htmlSize, { html: '<p>short</p>' })).toEqual([]);
  });
});

describe('tracking-params', () => {
  const trackingConfig = {
    enabled: true,
    params: [
      { key: 'utm_source', required: true },
      { key: 'utm_medium', required: true },
      { key: 'utm_term', required: false },
    ],
  };

  it('reports the required keys without a value', () => {
    const findings = findingsOf(trackingParams, {
      trackingConfig,
      trackingUrls: [{ key: 'utm_source', value: 'newsletter' }],
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      severity: 'error',
      params: { keys: 'utm_medium' },
    });
  });

  it('stays silent when tracking is off or complete', () => {
    expect(findingsOf(trackingParams, {})).toEqual([]);
    expect(
      findingsOf(trackingParams, {
        trackingConfig,
        trackingUrls: [
          { key: 'utm_source', value: 'a' },
          { key: 'utm_medium', value: 'b' },
        ],
      })
    ).toEqual([]);
  });
});
