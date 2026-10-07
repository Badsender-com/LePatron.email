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
 * Each check has a default state and, when it has some, thresholds with their
 * default, bounds and unit. The defaults are the quality control as it was
 * before groups could set it: every check on, the required tracking
 * parameters blocking.
 */

const CHECK_STATES = Object.freeze(['off', 'on', 'blocking']);

const t = (value, min, max, unit) =>
  Object.freeze({ default: value, min, max, unit });

const on = (thresholds = {}) =>
  Object.freeze({ defaultState: 'on', thresholds: Object.freeze(thresholds) });

const CHECKS = Object.freeze({
  // Copy
  subject: on({
    long: t(40, 10, 200, 'characters'),
    tooLong: t(60, 10, 255, 'characters'),
  }),
  preheader: on({
    long: t(100, 20, 300, 'characters'),
    tooLong: t(140, 20, 500, 'characters'),
  }),
  'merge-tags': on(),
  'empty-blocks': on(),
  'uppercase-text': on({ maxWords: t(5, 2, 30, 'words') }),
  // Accessibility
  'hidden-text': on(),
  'small-font': on({
    minSize: t(14, 6, 24, 'px'),
    minSizeHeaderFooter: t(12, 6, 24, 'px'),
  }),
  'color-contrast': on(),
  'text-layout': on({
    minLineHeight: t(1, 0.5, 2, 'ratio'),
    centredMaxChars: t(200, 20, 5000, 'characters'),
  }),
  'indistinct-links': on(),
  headings: on(),
  'alt-redundant': on(),
  'emoji-placement': on(),
  'unnamed-image-links': on(),
  'image-only-email': on({ minTextLength: t(100, 0, 5000, 'characters') }),
  // Content
  'tracking-params': Object.freeze({
    defaultState: 'blocking',
    thresholds: Object.freeze({}),
  }),
  'unfilled-links': on(),
  'malformed-links': on(),
  'displayed-urls': on(),
  'suspicious-links': on(),
  'images-without-link': on(),
  'unreplaced-images': on(),
  'background-images': on(),
  'insecure-urls': on(),
  // Technical
  'alt-text-quality': on({ maxLength: t(150, 20, 1000, 'characters') }),
  'unsupported-image-formats': on(),
  'forbidden-code': on(),
  'malformed-html': on(),
  'unsupported-code': on(),
  'loose-code': on(),
  'html-size': on({ maxKb: t(100, 10, 2048, 'KB') }),
  // Checked by the server
  'broken-links': on(),
  'dangerous-links': on(),
  'domain-blocklists': on(),
  'image-weight': on({
    maxKb: t(500, 10, 10240, 'KB'),
    maxGifKb: t(1024, 10, 10240, 'KB'),
  }),
  'images-total-weight': on({
    warningKb: t(500, 10, 20480, 'KB'),
    errorKb: t(1024, 10, 20480, 'KB'),
  }),
  'oversized-images': on({ maxRatio: t(2, 1, 10, 'ratio') }),
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
