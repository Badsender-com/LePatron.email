/**
 * @jest-environment jsdom
 */

'use strict';

// The editor applies the quality settings of the mailing (epic #1193, ADR
// 0004): a check that is off is neither run nor listed, the thresholds in force
// are applied and quoted, and a finding of a blocking check stops the download
// and the ESP send and cannot be ignored.

const ko = require('knockout');
const {
  runQualityChecks,
} = require('../../../packages/editor/src/js/ext/quality/engine.js');
const {
  installQualityReview,
} = require('../../../packages/editor/src/js/ext/quality/quality-review.js');
const { fakeViewModel, exportOf } = require('./fake-view-model');

const RULES = '../../../packages/editor/src/js/ext/quality/rules';

// A view model whose metadata carries resolved quality settings, as the server
// sends them: only the checks a test cares about are listed, the others keep
// their default.
function withSettings(options, checks) {
  const vm = fakeViewModel(options);
  vm.metadata.qualitySettings = { checks };
  return vm;
}

const textBlock = (longText) => ({
  blocks: [{ id: 'b1', type: 'textBlock', longText }],
  blockDefs: [{ type: 'textBlock', longText: '<p>Sample</p>' }],
  html: exportOf({ b1: longText }),
});

describe('a check that is off', () => {
  it('is neither run nor listed, and is reported as turned off', () => {
    const vm = withSettings(textBlock('<p>Sale 🔥🔥 today</p>'), {
      'emoji-placement': { state: 'off', thresholds: {} },
    });
    const result = runQualityChecks(vm);
    expect(
      result.findings.filter((f) => f.ruleId === 'emoji-placement')
    ).toEqual([]);
    expect(result.checks.map((c) => c.ruleId)).not.toContain('emoji-placement');
    expect(result.turnedOff).toEqual(['emoji-placement']);
  });

  it('is counted by the review, for the drawer to say how many are off', () => {
    const vm = withSettings(textBlock('<p>Hi</p>'), {
      'emoji-placement': { state: 'off', thresholds: {} },
      headings: { state: 'off', thresholds: {} },
    });
    installQualityReview(vm, ko, { defer: (fn) => fn() });
    vm.quality.run();
    expect(vm.quality.turnedOffCount()).toBe(2);
  });

  it('runs every check as today when the mailing has no settings', () => {
    const vm = fakeViewModel(textBlock('<p>Sale 🔥🔥 today</p>'));
    const result = runQualityChecks(vm);
    expect(result.turnedOff).toEqual([]);
    expect(result.findings.map((f) => f.ruleId)).toContain('emoji-placement');
  });
});

describe('the thresholds in force', () => {
  const smallFont = require(`${RULES}/small-font`);

  it('are applied: 12 px passes when the group allows 11 px', () => {
    const vm = withSettings(
      textBlock('<p><span style="font-size: 12px">Terms</span></p>'),
      {
        'small-font': {
          state: 'on',
          thresholds: { minSize: 11, minSizeHeaderFooter: 11 },
        },
      }
    );
    expect(runQualityChecks(vm, { rules: [smallFont] }).findings).toEqual([]);
  });

  it('are quoted by the message', () => {
    const vm = withSettings(
      textBlock('<p><span style="font-size: 10px">Terms</span></p>'),
      {
        'small-font': {
          state: 'on',
          thresholds: { minSize: 11, minSizeHeaderFooter: 11 },
        },
      }
    );
    const [finding] = runQualityChecks(vm, { rules: [smallFont] }).findings;
    expect(finding.params).toMatchObject({ size: 10, min: 11 });
  });

  it("drive the subject's length checks", () => {
    const subject = require(`${RULES}/subject`);
    const vm = withSettings(
      {},
      {
        subject: { state: 'on', thresholds: { long: 30, tooLong: 50 } },
      }
    );
    vm.emailMetadataStore = {
      isActive: () => true,
      snapshot: () => ({ subject: 'a'.repeat(35) }),
    };
    const [finding] = runQualityChecks(vm, { rules: [subject] }).findings;
    expect(finding).toMatchObject({
      severity: 'info',
      params: { count: 35, max: 30 },
    });
  });
});

// Turned on by #1200 (make a check blocking for the download)
describe.skip('a blocking check', () => {
  const unfilled = textBlock('<a href="#toreplace">Shop now</a>');
  const blocking = { 'unfilled-links': { state: 'blocking', thresholds: {} } };

  function review(checks, { ignored = [] } = {}) {
    const vm = withSettings(unfilled, checks);
    vm.metadata.qualityIgnores = ignored;
    vm.notifier = { error: jest.fn() };
    installQualityReview(vm, ko, { defer: (fn) => fn() });
    return vm;
  }

  it('marks its findings as blocking', () => {
    const vm = withSettings(unfilled, blocking);
    const [finding] = runQualityChecks(vm).findings.filter(
      (f) => f.ruleId === 'unfilled-links'
    );
    expect(finding.blocking).toBe(true);
  });

  it('stops the export: gate() answers blocked, with the blocking findings', async () => {
    const vm = review(blocking);
    const verdict = await vm.quality.gate({ html: unfilled.html });
    expect(verdict.blocked).toBe(true);
    expect(verdict.findings.map((f) => f.ruleId)).toEqual(['unfilled-links']);
  });

  it('lets the export go when the same check is only on', async () => {
    const vm = review({ 'unfilled-links': { state: 'on', thresholds: {} } });
    const verdict = await vm.quality.gate({ html: unfilled.html });
    expect(verdict.blocked).toBe(false);
  });

  it('cannot be ignored: an ignore stored before it became blocking no longer counts', async () => {
    const first = runQualityChecks(
      withSettings(unfilled, blocking)
    ).findings.find((f) => f.ruleId === 'unfilled-links');
    const vm = review(blocking, { ignored: [first.fingerprint] });
    const verdict = await vm.quality.gate({ html: unfilled.html });
    expect(verdict.blocked).toBe(true);
    expect(vm.quality.ignoredFindings()).toEqual([]);
    expect(vm.quality.activeFindings().map((f) => f.fingerprint)).toContain(
      first.fingerprint
    );
  });
});

// Turned on by #1201 (blocking checks before an ESP send, and server checks that block)
describe.skip('a blocking check run by the server', () => {
  const link = textBlock('<a href="https://brand.test/gone">Our offer</a>');

  function review(answer) {
    const vm = withSettings(link, {
      'broken-links': { state: 'blocking', thresholds: {} },
    });
    vm.metadata.url = {
      qualityResources: '/api/mailings/m1/quality/resources',
    };
    vm.notifier = { error: jest.fn() };
    installQualityReview(vm, ko, {
      defer: (fn) => fn(),
      checkResources: answer,
    });
    return vm;
  }

  it('makes the export wait for the server, and blocks on a definitive answer', async () => {
    const vm = review(() =>
      Promise.resolve({
        links: {
          'https://brand.test/gone': { state: 'broken', httpStatus: 404 },
        },
        images: {},
      })
    );
    const verdict = await vm.quality.gate({ html: link.html });
    expect(verdict.blocked).toBe(true);
    expect(verdict.findings.map((f) => f.ruleId)).toEqual(['broken-links']);
  });

  it('never blocks on an unverifiable answer', async () => {
    const vm = review(() =>
      Promise.resolve({
        links: {
          'https://brand.test/gone': { state: 'unverifiable', httpStatus: 403 },
        },
        images: {},
      })
    );
    expect((await vm.quality.gate({ html: link.html })).blocked).toBe(false);
  });

  it('never blocks when the server cannot be reached', async () => {
    const vm = review(() => Promise.reject(new Error('Network Error')));
    expect((await vm.quality.gate({ html: link.html })).blocked).toBe(false);
  });
});
