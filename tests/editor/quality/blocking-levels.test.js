/**
 * @jest-environment jsdom
 */

'use strict';

// A blocking check blocks only on its most severe level, the highest severity
// the rule can report (ADR 0009): its lower levels stay findings that never
// block, and can still be ignored. The download and the ESP send stop on the
// findings marked `blocking`, and on them only.

const fs = require('fs');
const path = require('path');
const ko = require('knockout');
const {
  runQualityChecks,
  DEFAULT_RULES,
  REMOTE_RULES,
} = require('../../../packages/editor/src/js/ext/quality/engine.js');
const {
  mostSevereLevel,
} = require('../../../packages/editor/src/js/ext/quality/levels.js');
const {
  installQualityReview,
} = require('../../../packages/editor/src/js/ext/quality/quality-review.js');
const { fakeViewModel, copyViewModel, exportOf } = require('./fake-view-model');
const { vmWith, remoteOf } = require('./remote-fixtures');

const RULES_DIR = path.join(
  __dirname,
  '../../../packages/editor/src/js/ext/quality/rules'
);
const rule = (id) => require(path.join(RULES_DIR, id));
const KB = 1024;

const blockingSettings = (id, thresholds = {}) => ({
  checks: { [id]: { state: 'blocking', thresholds } },
});

// The findings of one blocking rule, as the engine completes them.
function run(vm, id, { thresholds, remote } = {}) {
  vm.metadata.qualitySettings = blockingSettings(id, thresholds);
  return runQualityChecks(vm, { rules: [rule(id)], remote }).findings;
}

const summary = (findings) =>
  findings.map((f) => ({ severity: f.severity, blocking: f.blocking }));

describe('the most severe level of a rule', () => {
  it('is its only severity when the rule declares no levels', () => {
    expect(mostSevereLevel(rule('headings'))).toBe('info');
    expect(mostSevereLevel(rule('unfilled-links'))).toBe('error');
  });

  it.each([
    ['subject', 'warning'],
    ['preheader', 'warning'],
    ['html-size', 'warning'],
    ['images-total-weight', 'error'],
    ['broken-links', 'error'],
    ['color-contrast', 'error'],
    ['unreplaced-images', 'error'],
  ])('is read from what %s declares: %s', (id, level) => {
    expect(mostSevereLevel(rule(id))).toBe(level);
  });

  // A rule that reports a severity it does not declare would block on the
  // wrong level: every severity written in a rule is one of its levels.
  it.each([...DEFAULT_RULES, ...REMOTE_RULES].map((r) => [r.id, r]))(
    '%s declares every severity it can report',
    (id, r) => {
      const source = fs.readFileSync(path.join(RULES_DIR, `${id}.js`), 'utf8');
      const written = source.match(/'(info|warning|error)'/g) || [];
      const levels = r.levels || [r.severity];
      expect(levels).toContain(r.severity);
      written.forEach((literal) => {
        expect(levels).toContain(literal.replace(/'/g, ''));
      });
    }
  );
});

describe('a blocking subject', () => {
  const findingsFor = (length) =>
    run(copyViewModel({ subjectValue: 'a'.repeat(length) }), 'subject', {
      thresholds: { long: 40, tooLong: 60 },
    });

  it('does not block on a long subject: an info', () => {
    expect(summary(findingsFor(50))).toEqual([
      { severity: 'info', blocking: false },
    ]);
  });

  it('blocks on a subject too long', () => {
    expect(summary(findingsFor(70))).toEqual([
      { severity: 'warning', blocking: true },
    ]);
  });
});

describe('a blocking html-size', () => {
  const findingsFor = (maxKb, bytes) =>
    run(fakeViewModel({ html: 'a'.repeat(bytes) }), 'html-size', {
      thresholds: { maxKb },
    });

  // Recette of the blocking batch: 150 KB set, a 114 KB email blocked.
  it("never blocks on Gmail's clipping under the company's threshold", () => {
    expect(summary(findingsFor(150, 114 * KB))).toEqual([
      { severity: 'info', blocking: false },
    ]);
  });

  it('blocks past the threshold', () => {
    expect(summary(findingsFor(150, 160 * KB))).toEqual([
      { severity: 'warning', blocking: true },
    ]);
  });
});

describe('a blocking images-total-weight', () => {
  const img = (src) => `<img src="${src}" width="600">`;
  const findingsFor = (bytes) =>
    run(vmWith(img('https://cdn.test/a.jpg')), 'images-total-weight', {
      remote: remoteOf({
        images: { 'https://cdn.test/a.jpg': { state: 'ok', bytes } },
      }),
    });

  it('does not block on its warning level', () => {
    expect(summary(findingsFor(600 * KB))).toEqual([
      { severity: 'warning', blocking: false },
    ]);
  });

  it('blocks on its error level', () => {
    expect(summary(findingsFor(1200 * KB))).toEqual([
      { severity: 'error', blocking: true },
    ]);
  });
});

describe('a blocking rule with a single level', () => {
  it('blocks on all its findings, even infos', () => {
    const longText = '<h2></h2><h2>Offer</h2><h5>Terms</h5>';
    const vm = fakeViewModel({
      blocks: [{ id: 'b1', type: 'textBlock', longText }],
      blockDefs: [{ type: 'textBlock', longText: '<p>Sample</p>' }],
      html: exportOf({ b1: longText }),
    });
    const findings = run(vm, 'headings');
    expect(findings.length).toBeGreaterThan(1);
    expect(findings.every((f) => f.severity === 'info' && f.blocking)).toBe(
      true
    );
  });
});

describe('the review of a blocking rule with several levels', () => {
  const settings = blockingSettings('subject', { long: 40, tooLong: 60 });
  const subjectOf = (length) => 'a'.repeat(length);

  function review(subject, { ignored = [] } = {}) {
    const vm = copyViewModel({ subjectValue: subject });
    vm.metadata.qualitySettings = settings;
    vm.metadata.qualityIgnores = ignored;
    vm.metadata.url = { qualityIgnores: '/api/mailings/m1/quality-ignores' };
    vm.notifier = { error: jest.fn() };
    installQualityReview(vm, ko, {
      defer: (fn) => fn(),
      persist: () => Promise.resolve(),
    });
    vm.quality.run();
    return vm;
  }

  const fingerprintOf = (subject) => {
    const vm = copyViewModel({ subjectValue: subject });
    vm.metadata.qualitySettings = settings;
    return runQualityChecks(vm, { rules: [rule('subject')] }).findings[0]
      .fingerprint;
  };

  it('neither counts a lower level as blocking nor on the badge', () => {
    const vm = review(subjectOf(50));
    expect(vm.quality.blockingCount()).toBe(0);
    expect(vm.quality.issueCount()).toBe(0);
  });

  it('counts its most severe level as blocking, on the badge too', () => {
    const vm = review(subjectOf(70));
    expect(vm.quality.blockingCount()).toBe(1);
    expect(vm.quality.issueCount()).toBe(1);
  });

  it('lets the export go on a lower level only', async () => {
    const vm = review(subjectOf(50));
    expect((await vm.quality.gate()).blocked).toBe(false);
  });

  it('keeps an ignore of a lower level', () => {
    const subject = subjectOf(50);
    const vm = review(subject, { ignored: [fingerprintOf(subject)] });
    expect(vm.quality.activeFindings()).toEqual([]);
    expect(vm.quality.ignoredFindings()).toHaveLength(1);
  });

  it('lets a lower level be ignored', async () => {
    const vm = review(subjectOf(50));
    const [finding] = vm.quality.activeFindings();
    await vm.quality.ignore(finding);
    expect(vm.quality.activeFindings()).toEqual([]);
  });

  it('does not let its most severe level be ignored, nor an older ignore hide it', async () => {
    const subject = subjectOf(70);
    const vm = review(subject, { ignored: [fingerprintOf(subject)] });
    expect(vm.quality.ignoredFindings()).toEqual([]);
    const [finding] = vm.quality.activeFindings();
    await vm.quality.ignore(finding);
    expect(vm.quality.activeFindings()).toEqual([finding]);
    expect((await vm.quality.gate()).blocked).toBe(true);
  });
});
