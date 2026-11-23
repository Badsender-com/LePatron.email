'use strict';

// Read by the server, which gives a mailing its settings, and by the admin
// pages, which show what a template applies: one resolution for both.
// No syntax that needs a Babel helper here (see checks.js): spread,
// destructuring, classes, `for...of`.

const catalogue = require('./checks.js');

const CHECKS = catalogue.CHECKS;
const CHECK_STATES = catalogue.CHECK_STATES;
const defaultQualitySettings = catalogue.defaultQualitySettings;

const own = (object, key) =>
  Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
// Not `typeof value === 'object'`: Babel wraps that comparison in a helper.
const isObject = (value) => Boolean(value) && Object(value) === value;

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

/**
 * One check's thresholds on a template: its own over the inherited ones, an
 * inherited value it contradicts brought to its own. Paired thresholds are
 * checked in order when they are written, against the group's values at that
 * time; the group may move later without its templates being checked again.
 * When one value of a pair is the template's and the other inherited, and
 * they are out of order, the template's wins. Two values of the same level
 * were checked together and are left as they are.
 *
 * @param {string} checkId
 * @param {Object} inherited every threshold of the check, as the group
 *   resolves it
 * @param {Object} ownThresholds the template's own thresholds: only finite
 *   numbers of the catalogue apply
 * @returns {{ thresholds: Object, adjustments: Array<{ threshold: string,
 *   inherited: number, value: number }> }}
 */
function templateThresholds(checkId, inherited, ownThresholds) {
  const thresholds = Object.assign({}, inherited);
  const names = [];
  Object.keys(ownThresholds || {}).forEach((name) => {
    const value = ownThresholds[name];
    if (own(CHECKS[checkId].thresholds, name) && Number.isFinite(value)) {
      thresholds[name] = value;
      names.push(name);
    }
  });
  const adjustments = [];
  CHECKS[checkId].ordered.forEach((pair) => {
    const low = pair[0];
    const high = pair[1];
    if (names.includes(low) === names.includes(high)) return;
    if (thresholds[low] <= thresholds[high]) return;
    const kept = names.includes(low) ? low : high;
    const moved = kept === low ? high : low;
    adjustments.push({
      threshold: moved,
      inherited: thresholds[moved],
      value: thresholds[kept],
    });
    thresholds[moved] = thresholds[kept];
  });
  return { thresholds, adjustments };
}

// What is stored is read defensively: a super admin may write these fields
// without the sanitizer, and only catalogue keys may be applied.
function settingOf(checks, checkId) {
  const setting = checks[checkId];
  if (!own(CHECKS, checkId) || !isObject(setting)) {
    return null;
  }
  return {
    state: CHECK_STATES.includes(setting.state) ? setting.state : null,
    thresholds: isObject(setting.thresholds) ? setting.thresholds : {},
  };
}

function resolveLayers(group, template) {
  const resolved = defaultQualitySettings();
  const groupChecks = checksOf(group);
  Object.keys(groupChecks).forEach((checkId) => {
    const setting = settingOf(groupChecks, checkId);
    if (!setting) return;
    const target = resolved.checks[checkId];
    if (setting.state) target.state = setting.state;
    Object.keys(setting.thresholds).forEach((name) => {
      const value = setting.thresholds[name];
      if (own(CHECKS[checkId].thresholds, name) && Number.isFinite(value)) {
        target.thresholds[name] = value;
      }
    });
  });
  const adjustments = [];
  const templateChecks = checksOf(template);
  Object.keys(templateChecks).forEach((checkId) => {
    const setting = settingOf(templateChecks, checkId);
    if (!setting) return;
    const target = resolved.checks[checkId];
    if (setting.state) target.state = setting.state;
    const result = templateThresholds(
      checkId,
      target.thresholds,
      setting.thresholds
    );
    target.thresholds = result.thresholds;
    result.adjustments.forEach((adjustment) => {
      adjustments.push(Object.assign({ checkId }, adjustment));
    });
  });
  return { resolved, adjustments };
}

function checksOf(owner) {
  const raw = owner && owner.qualitySettings;
  const settings =
    raw && typeof raw.toObject === 'function' ? raw.toObject() : raw;
  const checks = settings && settings.checks;
  return isObject(checks) ? checks : {};
}

module.exports = {
  resolveQualitySettings,
  adjustedThresholds,
  templateThresholds,
};
