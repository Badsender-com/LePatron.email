'use strict';

// The check catalogue is the contract between the editor (which runs the
// checks), the server (which validates a group's quality settings) and the
// admin page: a setting the server accepts must always be one the editor
// knows. Epic #1193, ADR 0009.

const {
  DEFAULT_RULES,
  REMOTE_RULES,
} = require('../../../packages/editor/src/js/ext/quality/engine.js');

describe('the shared check catalogue', () => {
  let CHECKS;
  let CHECK_STATES;
  let defaultQualitySettings;

  beforeAll(() => {
    ({
      CHECKS,
      CHECK_STATES,
      defaultQualitySettings,
    } = require('../../../packages/shared/quality/checks.js'));
  });

  it('knows the three check states', () => {
    expect(CHECK_STATES).toEqual(['off', 'on', 'blocking']);
  });

  it('lists every check the editor runs, and nothing else', () => {
    const ruleIds = DEFAULT_RULES.concat(REMOTE_RULES).map((rule) => rule.id);
    expect(Object.keys(CHECKS).sort()).toEqual(ruleIds.sort());
  });

  // The editor's lists are tied to these in tests/editor/quality/server-checks.test.js.
  it('derives the checks the export waits for from what each asks the server', () => {
    const {
      SERVER_CHECKS,
    } = require('../../../packages/shared/quality/checks.js');
    expect(SERVER_CHECKS).toEqual([
      'broken-links',
      'dangerous-links',
      'domain-blocklists',
      'image-weight',
      'images-total-weight',
      'oversized-images',
    ]);
  });

  it('derives what the server does for each check reading its answer', () => {
    const {
      SERVER_TASKS,
    } = require('../../../packages/shared/quality/checks.js');
    expect(SERVER_TASKS).toEqual({
      'broken-links': 'linkProbes',
      'dangerous-links': 'webRisk',
      'domain-blocklists': 'blocklists',
      'image-weight': 'images',
      'images-total-weight': 'images',
      'oversized-images': 'images',
      'unsupported-image-formats': 'images',
    });
  });

  it('asks nothing of the server for the other checks', () => {
    const {
      SERVER_TASKS,
    } = require('../../../packages/shared/quality/checks.js');
    Object.keys(CHECKS)
      .filter((id) => !(id in SERVER_TASKS))
      .forEach((id) => expect([id, CHECKS[id].server]).toEqual([id, null]));
  });

  it('gives each check the category its rule declares', () => {
    DEFAULT_RULES.concat(REMOTE_RULES).forEach((rule) => {
      expect([rule.id, CHECKS[rule.id].category]).toEqual([
        rule.id,
        rule.category,
      ]);
    });
  });

  it("keeps today's behavior by default: every check on, tracking blocking", () => {
    Object.entries(CHECKS).forEach(([id, check]) => {
      expect(check.defaultState).toBe(
        id === 'tracking-params' ? 'blocking' : 'on'
      );
    });
  });

  it.each([
    ['subject', 'long', 40],
    ['subject', 'tooLong', 60],
    ['preheader', 'long', 100],
    ['preheader', 'tooLong', 140],
    ['uppercase-text', 'maxWords', 5],
    ['small-font', 'minSize', 14],
    ['small-font', 'minSizeHeaderFooter', 12],
    ['html-size', 'maxKb', 100],
    ['image-weight', 'maxKb', 500],
    ['image-weight', 'maxGifKb', 1024],
    ['images-total-weight', 'warningKb', 500],
    ['images-total-weight', 'errorKb', 1024],
    ['image-only-email', 'minTextLength', 100],
    ['alt-text-quality', 'maxLength', 150],
    ['oversized-images', 'maxRatio', 2],
    ['text-layout', 'minLineHeight', 1],
    ['text-layout', 'centredMaxChars', 200],
  ])('sets %s %s to %s by default', (id, name, value) => {
    expect(CHECKS[id].thresholds[name].default).toBe(value);
  });

  // Read before beforeAll: it.each needs the list when the tests are declared.
  const {
    CHECKS: CATALOGUE,
  } = require('../../../packages/shared/quality/checks.js');
  const THRESHOLDS = Object.entries(CATALOGUE).flatMap(([id, check]) =>
    Object.entries(check.thresholds).map(([name, threshold]) => [
      id,
      name,
      threshold,
    ])
  );

  it.each(THRESHOLDS)(
    'bounds %s %s around its default, with a unit',
    (id, name, threshold) => {
      expect(threshold.min).toBeLessThan(threshold.max);
      expect(threshold.default).toBeGreaterThanOrEqual(threshold.min);
      expect(threshold.default).toBeLessThanOrEqual(threshold.max);
      expect(typeof threshold.unit).toBe('string');
    }
  );

  it('never lets a minimum of text be set so low the check cannot fire', () => {
    expect(CHECKS['image-only-email'].thresholds.minTextLength.min).toBe(1);
  });

  it('gives the resolved defaults the editor gets when nothing is set', () => {
    const settings = defaultQualitySettings();
    expect(settings.checks['tracking-params']).toEqual({
      state: 'blocking',
      thresholds: {},
    });
    expect(settings.checks.subject).toEqual({
      state: 'on',
      thresholds: { long: 40, tooLong: 60 },
    });
  });
});
