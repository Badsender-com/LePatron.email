/**
 * @jest-environment jsdom
 */

'use strict';

const {
  runQualityChecks,
} = require('../../../packages/editor/src/js/ext/quality/engine.js');
const { fakeViewModel } = require('./fake-view-model');

const RULES = '../../../packages/editor/src/js/ext/quality/rules';
const backgroundImages = require(`${RULES}/background-images`);
const htmlSize = require(`${RULES}/html-size`);
const trackingParams = require(`${RULES}/tracking-params`);

function findingsOf(rule, vmOptions) {
  return runQualityChecks(fakeViewModel(vmOptions), { rules: [rule] }).findings;
}

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
