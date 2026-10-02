/**
 * @jest-environment jsdom
 */

'use strict';

const { findingsOf } = require('./fake-view-model');

const RULES = '../../../packages/editor/src/js/ext/quality/rules';
const htmlSize = require(`${RULES}/html-size`);
const trackingParams = require(`${RULES}/tracking-params`);

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
