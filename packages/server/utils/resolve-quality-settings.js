'use strict';

const {
  CHECKS,
  defaultQualitySettings,
} = require('../../shared/quality/checks.js');

/**
 * The quality settings a mailing gets: for every check and every threshold,
 * its template's value if it sets one, else its group's, else the catalogue's
 * default (docs/adr/0004-quality-settings-per-group-and-template.md). Unlike the
 * tracking settings, a template never replaces its group's settings as a whole:
 * whatever it does not set follows the group, later changes included.
 *
 * @param {Object|null} group - with `qualitySettings`, a plain object or a
 *   Mongoose document
 * @param {Object|null} template - same
 * @returns {{ checks: Object<string, { state: string, thresholds: Object }> }}
 *   every check of the catalogue, with its state and all its thresholds
 */
function resolveQualitySettings(group, template) {
  const resolved = defaultQualitySettings();
  [checksOf(group), checksOf(template)].forEach((checks) => {
    Object.entries(checks).forEach(([checkId, setting]) => {
      const target = resolved.checks[checkId];
      if (!target || !setting) return;
      if (setting.state) target.state = setting.state;
      Object.entries(setting.thresholds || {}).forEach(([name, value]) => {
        if (name in CHECKS[checkId].thresholds && typeof value === 'number') {
          target.thresholds[name] = value;
        }
      });
    });
  });
  return resolved;
}

function checksOf(owner) {
  const raw = owner && owner.qualitySettings;
  const settings =
    raw && typeof raw.toObject === 'function' ? raw.toObject() : raw;
  return (settings && settings.checks) || {};
}

module.exports = { resolveQualitySettings };
