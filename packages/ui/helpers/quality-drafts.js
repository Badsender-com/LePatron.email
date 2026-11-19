import isEqual from 'lodash/isEqual';
import { CHECKS } from '~/helpers/constants/quality-checks.js';
import {
  adjustmentsOf,
  exceptionsOf,
  generalOf,
  isSet,
  recommendedOf,
  thresholdNames,
  toNumber,
} from '~/helpers/quality-exceptions.js';

// What the general page shows of its unsaved changes: what will apply once
// saved, and the templates a change will not reach.

/**
 * The general settings as edited, in the shape of stored settings: what will
 * apply once saved. A value with an error is left out, the save being
 * refused until it is fixed, and so is a value equal to the recommended one,
 * which the save drops.
 * @param {Object} drafts the exceptions as edited, by check
 * @param {Object} [errors] fieldErrors by check
 * @returns {{ checks: Object }}
 */
export function generalOfDrafts(drafts, errors = {}) {
  return {
    checks: Object.fromEntries(
      Object.keys(drafts).map((id) => {
        const draft = drafts[id] || {};
        const recommended = recommendedOf(id);
        const invalid = errors[id] || {};
        const thresholds = {};
        Object.entries(draft.thresholds || {}).forEach(([name, raw]) => {
          const value = toNumber(raw);
          if (
            Number.isFinite(value) &&
            !invalid[name] &&
            value !== recommended.thresholds[name]
          ) {
            thresholds[name] = value;
          }
        });
        const state =
          isSet(draft.state) && draft.state !== recommended.state
            ? draft.state
            : null;
        return [id, { state, thresholds }];
      })
    ),
  };
}

/**
 * The templates an unsaved change of a general setting will not reach: those
 * that set their own value of what changed, or one the new general value
 * contradicts (their own wins, effectiveOf).
 * @param {string} id
 * @param {Object} drafted the general settings as edited (generalOfDrafts)
 * @param {Object} saved the general settings as stored
 * @param {Object[]} templates the group's, with their `qualitySettings`
 * @returns {Object[]} those templates
 */
export function templatesKeepingOwn(id, drafted, saved, templates) {
  const before = generalOf(saved)[id];
  const after = generalOf(drafted)[id];
  const names = thresholdNames(id).filter(
    (name) => before.thresholds[name] !== after.thresholds[name]
  );
  const stateChanged = before.state !== after.state;
  if (!names.length && !stateChanged) return [];
  return templates.filter((template) => {
    const exception = exceptionsOf(template.qualitySettings)[id];
    if (!exception) return false;
    if (stateChanged && isSet(exception.state)) return true;
    if (names.some((name) => isSet(exception.thresholds[name]))) return true;
    return adjustmentsOf(id, exception, after).some((adjustment) =>
      names.includes(adjustment.threshold)
    );
  });
}

/**
 * By check, the names of the templates its unsaved change will not reach.
 * @param {string[]} ids the checks shown
 * @returns {Object<string, string[]>}
 */
export function keptByOf(ids, drafted, saved, templates) {
  if (!templates.length) return {};
  return Object.fromEntries(
    ids.map((id) => [
      id,
      templatesKeepingOwn(id, drafted, saved, templates).map(
        (template) => template.name
      ),
    ])
  );
}

/**
 * The rows of the table of every check: what will apply, whether it is an
 * exception, and whether it differs from what is saved.
 * @param {Object} [drafted] the general settings as edited
 * @param {Object} [saved] the general settings as stored
 * @returns {Array<{ id: string, applied: Object, isException: boolean,
 *   unsaved: boolean }>}
 */
export function referenceRows(drafted, saved) {
  const applied = generalOf(drafted);
  const before = generalOf(saved);
  const exceptions = exceptionsOf(drafted);
  return Object.keys(CHECKS).map((id) => ({
    id,
    applied: applied[id],
    isException: Boolean(exceptions[id]),
    unsaved: !isEqual(applied[id], before[id]),
  }));
}
