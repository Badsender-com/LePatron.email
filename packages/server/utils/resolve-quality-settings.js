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
 * default (docs/adr/0009-quality-settings-per-group-and-template.md). Unlike the
 * tracking settings, a template never replaces its group's settings as a whole:
 * whatever it does not set follows the group, later changes included.
 *
 * A template's threshold wins over an inherited one it contradicts: when the
 * group later moves a paired threshold past the template's own, the inherited
 * value is brought to the template's (`adjustedThresholds` lists them).
 *
 * @param {Object|null} group - with `qualitySettings`, a plain object or a
 *   Mongoose document
 * @param {Object|null} template - same
 * @returns {{ checks: Object<string, { state: string, thresholds: Object }> }}
 *   every check of the catalogue, with its state and all its thresholds
 */
function resolveQualitySettings(group, template) {
  return resolveLayers(group, template).resolved;
}

/**
 * The inherited thresholds `resolveQualitySettings` brought to the level of a
 * template's own, so that a page can say the template's setting overrode them.
 *
 * @param {Object|null} group
 * @param {Object|null} template
 * @returns {Array<{ checkId: string, threshold: string, inherited: number,
 *   value: number }>} the threshold moved, its inherited value and the one
 *   it gets
 */
function adjustedThresholds(group, template) {
  return resolveLayers(group, template).adjustments;
}

function resolveLayers(group, template) {
  const resolved = defaultQualitySettings();
  // The thresholds each check takes from the template, by check id.
  const fromTemplate = {};
  [
    [checksOf(group), null],
    [checksOf(template), fromTemplate],
  ].forEach(([checks, origins]) => {
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
          if (origins) (origins[checkId] = origins[checkId] || []).push(name);
        }
      });
    });
  });
  return { resolved, adjustments: keepTemplateOrder(resolved, fromTemplate) };
}

// Paired thresholds are checked in order when they are written, against the
// group's values at that time; the group may move later without its templates
// being checked again. When one value of a pair is the template's and the
// other inherited, and they are out of order, the template's exception wins:
// the inherited value is brought to it. Two values of the same level were
// checked together and are left as they are.
function keepTemplateOrder(resolved, fromTemplate) {
  const adjustments = [];
  Object.entries(fromTemplate).forEach(([checkId, names]) => {
    const { thresholds } = resolved.checks[checkId];
    CHECKS[checkId].ordered.forEach(([low, high]) => {
      if (names.includes(low) === names.includes(high)) return;
      if (thresholds[low] <= thresholds[high]) return;
      const [kept, moved] = names.includes(low) ? [low, high] : [high, low];
      adjustments.push({
        checkId,
        threshold: moved,
        inherited: thresholds[moved],
        value: thresholds[kept],
      });
      thresholds[moved] = thresholds[kept];
    });
  });
  return adjustments;
}

function checksOf(owner) {
  const raw = owner && owner.qualitySettings;
  const settings =
    raw && typeof raw.toObject === 'function' ? raw.toObject() : raw;
  const checks = settings && settings.checks;
  return checks && typeof checks === 'object' ? checks : {};
}

module.exports = { resolveQualitySettings, adjustedThresholds };
