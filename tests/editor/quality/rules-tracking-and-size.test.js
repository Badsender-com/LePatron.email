/**
 * @jest-environment jsdom
 */

'use strict';

const {
  runQualityChecks,
} = require('../../../packages/editor/src/js/ext/quality/engine.js');
const { findingsOf, fakeViewModel } = require('./fake-view-model');

const RULES = '../../../packages/editor/src/js/ext/quality/rules';
const htmlSize = require(`${RULES}/html-size`);
const trackingParams = require(`${RULES}/tracking-params`);

describe('html-size', () => {
  it('warns above 100 KB, short of the 102 KB Gmail clipping, with the size', () => {
    const html = `<p>${'a'.repeat(101 * 1024)}</p>`;
    const findings = findingsOf(htmlSize, { html });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ severity: 'warning', blockId: null });
    expect(findings[0].params.size).toBeGreaterThan(100);
  });

  it('fingerprints the size in KB, so it changes with a new size only', () => {
    const fingerprintOf = (bytes) =>
      findingsOf(htmlSize, { html: 'a'.repeat(bytes) })[0].fingerprint;

    expect(fingerprintOf(110 * 1024 - 10)).toBe(fingerprintOf(110 * 1024));
    expect(fingerprintOf(110 * 1024)).not.toBe(fingerprintOf(120 * 1024));
  });

  it('stays silent below the limit', () => {
    expect(findingsOf(htmlSize, { html: '<p>short</p>' })).toEqual([]);
  });

  it('warns from 100 KB exactly: passing means under 100 KB', () => {
    expect(findingsOf(htmlSize, { html: 'a'.repeat(100 * 1024 - 1) })).toEqual(
      []
    );
    const [finding] = findingsOf(htmlSize, { html: 'a'.repeat(100 * 1024) });
    expect(finding.params.size).toBe(100);
  });
});

describe('html-size, under a threshold the group set', () => {
  const KB = 1024;
  const WITHIN_THRESHOLD =
    'Exported HTML weighs __size__ KB: keep it under __max__, Gmail clips emails over 102 KB once the ESP adds its tracking';
  const OVER_THRESHOLD_AND_CLIPPED =
    'Exported HTML weighs __size__ KB, over the limit of __max__ set for your emails. Gmail will also clip it, as it does every email over 102 KB: the footer and the open tracking pixel will be hidden behind "Message clipped"';
  const CLIPPED =
    'Exported HTML weighs __size__ KB: Gmail will clip this email, as it does every email over 102 KB; the footer and the open tracking pixel will be hidden behind "Message clipped"';

  function run(maxKb, bytes) {
    const vm = fakeViewModel({ html: 'a'.repeat(bytes) });
    vm.metadata.qualitySettings = {
      checks: { 'html-size': { state: 'on', thresholds: { maxKb } } },
    };
    return runQualityChecks(vm, { rules: [htmlSize] });
  }

  it('quotes Gmail as the reason to stay under a threshold up to 102 KB', () => {
    const [finding] = run(80, 90 * KB).findings;
    expect(finding).toMatchObject({
      severity: 'warning',
      messageKey: WITHIN_THRESHOLD,
      params: { size: 90, max: { kb: 80 } },
    });
  });

  it('past a threshold above 102 KB, warns of it and of the clipping apart', () => {
    const [finding] = run(150, 160 * KB).findings;
    expect(finding).toMatchObject({
      severity: 'warning',
      messageKey: OVER_THRESHOLD_AND_CLIPPED,
      params: { size: 160, max: { kb: 150 } },
    });
  });

  it('under that threshold but over 102 KB, only informs of the clipping', () => {
    const { findings } = run(150, 120 * KB);
    expect(findings).toEqual([
      expect.objectContaining({
        severity: 'info',
        messageKey: CLIPPED,
        params: { size: 120 },
      }),
    ]);
  });

  it('keeps an ignored clipping info apart from the warning at the same size', () => {
    const info = run(150, 120 * KB).findings[0];
    const warning = run(110, 120 * KB).findings[0];
    expect(info.fingerprint).not.toBe(warning.fingerprint);
  });

  it('passes at 102 KB or less, the threshold quoted', () => {
    const { findings, checks } = run(150, 102 * KB);
    expect(findings).toEqual([]);
    expect(checks[0]).toMatchObject({
      status: 'passed',
      passParams: { size: 102, max: { kb: 150 } },
    });
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
