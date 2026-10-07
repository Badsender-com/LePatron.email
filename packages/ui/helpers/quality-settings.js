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
 * The payload that saves these states: a state equal to the default is sent as
 * `null`, so the group follows the default again rather than pinning it.
 * @param {Object<string, string>} states
 * @returns {{ checks: Object }}
 */
export function statesPayload(states) {
  return {
    checks: Object.fromEntries(
      Object.entries(states).map(([id, state]) => [
        id,
        { state: state === CHECKS[id].defaultState ? null : state },
      ])
    ),
  };
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
