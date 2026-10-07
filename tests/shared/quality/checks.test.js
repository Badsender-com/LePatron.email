'use strict';

// The check catalogue is the contract between the editor (which runs the
// checks), the server (which validates a group's quality settings) and the
// admin page: a setting the server accepts must always be one the editor
// knows. Epic #1193, ADR 0004.

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

  it('bounds every threshold around its default', () => {
    Object.values(CHECKS).forEach((check) => {
      Object.values(check.thresholds || {}).forEach((threshold) => {
        expect(threshold.min).toBeLessThanOrEqual(threshold.default);
        expect(threshold.max).toBeGreaterThanOrEqual(threshold.default);
        expect(typeof threshold.unit).toBe('string');
      });
    });
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
