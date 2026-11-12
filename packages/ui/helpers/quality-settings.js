import { ERROR_CODES } from '~/helpers/constants/error-codes.js';
import {
  CHECKS,
  CHECK_CATEGORIES,
} from '~/helpers/constants/quality-checks.js';

// Shared by the "Contrôle qualité" pages (docs/adr/0009-quality-settings-per-group-and-template.md).
// The exceptions themselves live in quality-exceptions.js.

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

/**
 * The snackbar text key for a failed save. A refusal is a change to a check
 * of the technical settings (TECH_CHECKS), the route already letting the
 * user reach the page.
 */
export function qualitySettingsErrorKeyFor(error) {
  const response = (error && error.response) || {};
  const data = response.data || {};
  if (response.status === 403) return 'qualitySettings.snackbars.forbidden';
  return data.message === ERROR_CODES.INVALID_QUALITY_SETTINGS
    ? 'qualitySettings.snackbars.invalid'
    : 'qualitySettings.snackbars.error';
}
