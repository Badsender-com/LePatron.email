'use strict';

const {
  CHECKS,
  CHECK_STATES,
  defaultQualitySettings,
} = require('../../shared/quality/checks.js');

const own = (object, key) =>
  Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);

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
    // What is stored is read defensively: a super admin may write these
    // fields without the sanitizer, and only catalogue keys may be applied.
    Object.entries(checks).forEach(([checkId, setting]) => {
      if (!own(CHECKS, checkId) || !setting || typeof setting !== 'object') {
        return;
      }
      const target = resolved.checks[checkId];
      if (CHECK_STATES.includes(setting.state)) target.state = setting.state;
      const thresholds =
        setting.thresholds && typeof setting.thresholds === 'object'
          ? setting.thresholds
          : {};
      Object.entries(thresholds).forEach(([name, value]) => {
        if (own(CHECKS[checkId].thresholds, name) && Number.isFinite(value)) {
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
  const checks = settings && settings.checks;
  return checks && typeof checks === 'object' ? checks : {};
}

module.exports = { resolveQualitySettings };
