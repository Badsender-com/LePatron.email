import isEqual from 'lodash/isEqual';
import { CHECKS } from '~/helpers/constants/quality-checks.js';
import {
  GENERAL,
  effectiveOf,
  isEmptyException,
  isSet,
  recommendedOf,
  thresholdNames,
  toNumber,
} from '~/helpers/quality-exceptions.js';

// What saving a level of the "Contrôle qualité" page sends, and what it
// refuses first: the same rules as the server's sanitizer
// (packages/server/utils/sanitize-quality-settings.js), so that the page never
// offers a save the server would refuse, nor refuses one it would accept.

// The exception as it is saved. In the general settings, a value equal to the
// recommended one sets nothing. On a template, a value equal to the general
// one is kept: it will not follow the general settings' later changes.
function normalized(level, id, exception) {
  const recommended = recommendedOf(id);
  const ex = exception || {};
  const thresholds = ex.thresholds || {};
  const keep = (value, recommendedValue) =>
    level === GENERAL && value === recommendedValue ? null : value;
  return {
    state: keep(isSet(ex.state) ? ex.state : null, recommended.state),
    thresholds: Object.fromEntries(
      thresholdNames(id).map((name) => [
        name,
        keep(toNumber(thresholds[name]), recommended.thresholds[name]),
      ])
    ),
  };
}

/**
 * The payload that saves a level: only the checks that changed since
 * `saved`, so two admins editing different checks do not overwrite each
 * other. An exception left out, or with nothing set any more, is removed.
 * @param {string} level GENERAL or TEMPLATE
 * @param {Object} drafts the exceptions as edited, by check
 * @param {Object} saved the exceptions as stored, by check
 * @returns {{ checks: Object }}
 */
export function exceptionsPayload(level, drafts, saved) {
  const ids = new Set(Object.keys(drafts).concat(Object.keys(saved)));
  const checks = {};
  ids.forEach((id) => {
    // Removed (the trash), whatever it held: values equal to the
    // recommended ones still have to leave the stored settings.
    if (saved[id] && !drafts[id]) {
      checks[id] = { state: null, thresholds: null };
      return;
    }
    const next = normalized(level, id, drafts[id]);
    const previous = normalized(level, id, saved[id]);
    if (isEqual(next, previous)) return;
    if (isEmptyException(next)) {
      checks[id] = { state: null, thresholds: null };
      return;
    }
    const anyThreshold = Object.values(next.thresholds).some(isSet);
    checks[id] = {
      state: next.state,
      thresholds: anyThreshold ? next.thresholds : null,
    };
  });
  return { checks };
}

/**
 * The errors of an exception's thresholds, by name: a value outside its
 * bounds, or a pair out of order. As the server does, a pair is checked only
 * when the edit changes one of its values: a template's saved value may face
 * an inherited one its group moved since, and then wins (effectiveOf). A pair
 * is compared on what is set (the exception's value, else the base's), and
 * its error goes on the field edited last, else on the higher level.
 * @param {string} id
 * @param {Object} exception as edited
 * @param {Object} base what applies without it
 * @param {string|null} [lastEdited] the threshold edited last
 * @param {Object|null} [saved] the exception as stored
 * @returns {Object<string, { key: string, params: Object }>}
 */
export function fieldErrors(
  id,
  exception,
  base,
  lastEdited = null,
  saved = null
) {
  const thresholds = (exception && exception.thresholds) || {};
  const savedThresholds = (saved && saved.thresholds) || {};
  const changed = (name) =>
    toNumber(thresholds[name]) !== toNumber(savedThresholds[name]);
  const errors = {};
  thresholdNames(id).forEach((name) => {
    if (!isSet(thresholds[name])) return;
    const value = Number(thresholds[name]);
    const { min, max } = CHECKS[id].thresholds[name];
    if (!Number.isFinite(value) || value < min || value > max) {
      errors[name] = {
        key: 'qualitySettings.thresholdError',
        params: { min, max },
      };
    }
  });
  const applied = effectiveOf(exception, base).thresholds;
  (CHECKS[id].ordered || []).forEach(([low, high]) => {
    if (errors[low] || errors[high] || applied[low] <= applied[high]) return;
    if (!changed(low) && !changed(high)) return;
    const owned = [low, high].filter((name) => isSet(thresholds[name]));
    if (!owned.length) return;
    let target = low;
    if (owned.includes(lastEdited)) target = lastEdited;
    else if (owned.includes(high)) target = high;
    errors[target] =
      target === high
        ? { key: 'qualitySettings.orderError', params: { value: applied[low] } }
        : {
            key: 'qualitySettings.orderErrorHigh',
            params: { value: applied[high] },
          };
  });
  return errors;
}
