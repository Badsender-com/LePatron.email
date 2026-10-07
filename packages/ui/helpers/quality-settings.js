import { ERROR_CODES } from '~/helpers/constants/error-codes.js';
import {
  CHECKS,
  CHECK_CATEGORIES,
} from '~/helpers/constants/quality-checks.js';

// The quality settings of a group, as the "Contrôle qualité" page edits them
// (docs/adr/0004-quality-settings-per-group-and-template.md). What is stored
// only holds what was set; everything else is the catalogue's default.

const storedChecks = (settings) => (settings && settings.checks) || {};

/**
 * The state of every check, as stored or by default.
 * @param {Object} [settings] the group's `qualitySettings`
 * @returns {Object<string, string>} check id -> 'off' | 'on' | 'blocking'
 */
export function statesOf(settings) {
  const stored = storedChecks(settings);
  return Object.fromEntries(
    Object.keys(CHECKS).map((id) => [
      id,
      (stored[id] && stored[id].state) || CHECKS[id].defaultState,
    ])
  );
}

/**
 * The payload that saves these states: only the checks that changed since
 * `saved`, so two admins editing different checks do not overwrite each
 * other; a state equal to the default is sent as `null`, so the group follows
 * the default again rather than pinning it.
 * @param {Object<string, string>} states
 * @param {Object<string, string>} [saved] the states as stored
 * @returns {{ checks: Object }}
 */
export function statesPayload(states, saved = {}) {
  return {
    checks: Object.fromEntries(
      Object.entries(states)
        .filter(([id, state]) => state !== saved[id])
        .map(([id, state]) => [
          id,
          { state: state === CHECKS[id].defaultState ? null : state },
        ])
    ),
  };
}

/**
 * The thresholds the group set, check by check: `null` where the default
 * applies, so the field shows the default as its placeholder.
 * @param {Object} [settings] the group's `qualitySettings`
 * @returns {Object<string, Object<string, number|null>>}
 */
export function thresholdsOf(settings) {
  const stored = storedChecks(settings);
  return Object.fromEntries(
    Object.keys(CHECKS)
      .filter((id) => Object.keys(CHECKS[id].thresholds).length)
      .map((id) => [
        id,
        Object.fromEntries(
          Object.keys(CHECKS[id].thresholds).map((name) => {
            const value = stored[id] && stored[id].thresholds;
            return [
              name,
              value && typeof value[name] === 'number' ? value[name] : null,
            ];
          })
        ),
      ])
  );
}

/**
 * The thresholds outside their bounds, as `checkId.name` keys.
 * @param {Object} thresholds as thresholdsOf returns them
 * @returns {string[]}
 */
export function thresholdErrors(thresholds) {
  return Object.entries(thresholds).flatMap(([id, values]) =>
    Object.entries(values)
      .filter(([name, value]) => {
        if (value === null || value === '' || value === undefined) return false;
        const { min, max } = CHECKS[id].thresholds[name];
        return !Number.isFinite(Number(value)) || value < min || value > max;
      })
      .map(([name]) => `${id}.${name}`)
  );
}

/**
 * The higher threshold of each pair set below its lower one, as
 * `checkId.name` keys (defaults fill what is not set).
 * @param {Object} thresholds as thresholdsOf returns them
 * @returns {string[]}
 */
export function orderErrors(thresholds) {
  return Object.entries(thresholds).flatMap(([id, values]) =>
    (CHECKS[id].ordered || [])
      .filter(([low, high]) => {
        const value = (name) =>
          values[name] === null ||
          values[name] === '' ||
          values[name] === undefined
            ? CHECKS[id].thresholds[name].default
            : Number(values[name]);
        return value(low) > value(high);
      })
      .map(([, high]) => `${id}.${high}`)
  );
}

/**
 * The payload that saves states and thresholds together, only what changed
 * since the saved values. A value equal to its default goes as `null`, so the
 * group follows the default again.
 * @returns {{ checks: Object }}
 */
export function settingsPayload(
  states,
  thresholds = {},
  savedStates = {},
  savedThresholds = {}
) {
  const { checks } = statesPayload(states, savedStates);
  Object.entries(thresholds).forEach(([id, values]) => {
    const saved = savedThresholds[id] || {};
    const changed = Object.entries(values).filter(
      ([name, value]) =>
        value !== (saved[name] === undefined ? null : saved[name])
    );
    if (!changed.length) return;
    checks[id] = {
      ...(checks[id] || {}),
      thresholds: Object.fromEntries(
        changed.map(([name, value]) => {
          const number = value === '' || value === null ? null : Number(value);
          const isDefault = number === CHECKS[id].thresholds[name].default;
          return [name, number === null || isDefault ? null : number];
        })
      ),
    };
  });
  return { checks };
}

/**
 * What a template overrides: a state or threshold it does not set is `null`,
 * meaning "inherited from the group".
 * @param {Object} [settings] the template's `qualitySettings`
 * @returns {{ states: Object<string, string|null>, thresholds: Object }}
 */
export function overridesOf(settings) {
  const stored = storedChecks(settings);
  return {
    states: Object.fromEntries(
      Object.keys(CHECKS).map((id) => [
        id,
        (stored[id] && stored[id].state) || null,
      ])
    ),
    thresholds: thresholdsOf(settings),
  };
}

/**
 * The payload that saves a template's overrides: whatever is `null` or empty
 * goes as `null`, so the template follows its group again.
 * @returns {{ checks: Object }}
 */
export function overridesPayload(states, thresholds = {}) {
  const checks = Object.fromEntries(
    Object.entries(states).map(([id, state]) => [id, { state: state || null }])
  );
  Object.entries(thresholds).forEach(([id, values]) => {
    checks[id].thresholds = Object.fromEntries(
      Object.entries(values).map(([name, value]) => [
        name,
        value === '' || value === null || value === undefined
          ? null
          : Number(value),
      ])
    );
  });
  return { checks };
}

/**
 * How many settings a template overrides, for its summary line.
 * @param {Object} [settings] the template's `qualitySettings`
 * @returns {number}
 */
export function overrideCount(settings) {
  return Object.values(storedChecks(settings)).reduce(
    (count, check) =>
      count +
      (check && check.state ? 1 : 0) +
      Object.keys((check && check.thresholds) || {}).length,
    0
  );
}

/**
 * The checks of each category, in the order the page lists them.
 * @returns {Array<{ category: string, ids: string[] }>}
 */
export function checksByCategory() {
  return CHECK_CATEGORIES.map((category) => ({
    category,
    ids: Object.keys(CHECKS).filter((id) => CHECKS[id].category === category),
  }));
}

/** The snackbar text key for a failed save. */
export function qualitySettingsErrorKeyFor(error) {
  const data = (error && error.response && error.response.data) || {};
  return data.message === ERROR_CODES.INVALID_QUALITY_SETTINGS
    ? 'qualitySettings.snackbars.invalid'
    : 'qualitySettings.snackbars.error';
}
