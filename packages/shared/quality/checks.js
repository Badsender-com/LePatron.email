'use strict';

/**
 * The quality control's checks, as a group's quality settings see them
 * (docs/adr/0004-quality-settings-per-group-and-template.md).
 *
 * One table for the editor, which runs the checks (ext/quality/rules), and the
 * server, which validates a group's or a template's settings: a setting the
 * server accepts is always one the editor knows. The admin page keeps a copy,
 * pinned by a sync test.
 *
 * Each check has its category (as the editor's rule declares it), a default
 * state and, when it has some, thresholds with their default, bounds and unit.
 * The defaults are the quality control as it was before groups could set it:
 * every check on, the required tracking parameters blocking.
 */

const CHECK_STATES = Object.freeze(['off', 'on', 'blocking']);

const t = (value, min, max, unit) =>
  Object.freeze({ default: value, min, max, unit });

const check = (category, thresholds = {}, defaultState = 'on') =>
  Object.freeze({
    category,
    defaultState,
    thresholds: Object.freeze(thresholds),
  });

const CHECKS = Object.freeze({
  // Copy
  subject: check('copy', {
    long: t(40, 10, 200, 'characters'),
    tooLong: t(60, 10, 255, 'characters'),
  }),
  preheader: check('copy', {
    long: t(100, 20, 300, 'characters'),
    tooLong: t(140, 20, 500, 'characters'),
  }),
  'merge-tags': check('copy'),
  'empty-blocks': check('copy'),
  // Accessibility
  'uppercase-text': check('accessibility', {
    maxWords: t(5, 2, 30, 'words'),
  }),
  'hidden-text': check('accessibility'),
  'small-font': check('accessibility', {
    minSize: t(14, 6, 24, 'px'),
    minSizeHeaderFooter: t(12, 6, 24, 'px'),
  }),
  'color-contrast': check('accessibility'),
  'text-layout': check('accessibility', {
    minLineHeight: t(1, 0.5, 2, 'ratio'),
    centredMaxChars: t(200, 20, 5000, 'characters'),
  }),
  'indistinct-links': check('accessibility'),
  headings: check('accessibility'),
  'alt-redundant': check('accessibility'),
  'emoji-placement': check('accessibility'),
  'unnamed-image-links': check('accessibility'),
  'alt-text-quality': check('accessibility', {
    maxLength: t(150, 20, 1000, 'characters'),
  }),
  // Content
  'tracking-params': check('content', {}, 'blocking'),
  'unfilled-links': check('content'),
  'malformed-links': check('content'),
  'displayed-urls': check('content'),
  'suspicious-links': check('content'),
  'images-without-link': check('content'),
  'unreplaced-images': check('content'),
  'background-images': check('content'),
  'image-only-email': check('content', {
    minTextLength: t(100, 0, 5000, 'characters'),
  }),
  'broken-links': check('content'),
  'dangerous-links': check('content'),
  'domain-blocklists': check('content'),
  // Technical
  'insecure-urls': check('technical'),
  'unsupported-image-formats': check('technical'),
  'forbidden-code': check('technical'),
  'malformed-html': check('technical'),
  'unsupported-code': check('technical'),
  'loose-code': check('technical'),
  'html-size': check('technical', { maxKb: t(100, 10, 2048, 'KB') }),
  // Performance, checked by the server
  'image-weight': check('performance', {
    maxKb: t(500, 10, 10240, 'KB'),
    maxGifKb: t(1024, 10, 10240, 'KB'),
  }),
  'images-total-weight': check('performance', {
    warningKb: t(500, 10, 20480, 'KB'),
    errorKb: t(1024, 10, 20480, 'KB'),
  }),
  'oversized-images': check('performance', {
    maxRatio: t(2, 1, 10, 'ratio'),
  }),
});

const defaultThresholds = (checkId) =>
  Object.fromEntries(
    Object.entries(CHECKS[checkId].thresholds).map(([name, threshold]) => [
      name,
      threshold.default,
    ])
  );

/**
 * The resolved settings of a group or template that set nothing: every check
 * with its default state and all its default thresholds.
 * @returns {{ checks: Object<string, { state: string, thresholds: Object }> }}
 */
function defaultQualitySettings() {
  return {
    checks: Object.fromEntries(
      Object.keys(CHECKS).map((id) => [
        id,
        { state: CHECKS[id].defaultState, thresholds: defaultThresholds(id) },
      ])
    ),
  };
}

module.exports = {
  CHECK_STATES,
  CHECKS,
  defaultThresholds,
  defaultQualitySettings,
};
