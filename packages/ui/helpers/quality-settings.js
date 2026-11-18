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

// The server's code for a change to a check of the technical settings
// (TECH_CHECKS) by a user who cannot set them. Read from ERROR_CODES once
// the UI's copy of the codes has it.
const FORBIDDEN_TECH_QUALITY_CHECK =
  ERROR_CODES.FORBIDDEN_TECH_QUALITY_CHECK || 'FORBIDDEN_TECH_QUALITY_CHECK';

const MESSAGES = {
  [FORBIDDEN_TECH_QUALITY_CHECK]: 'qualitySettings.snackbars.forbidden',
  [ERROR_CODES.INVALID_QUALITY_SETTINGS]: 'qualitySettings.snackbars.invalid',
};

/**
 * The snackbar text key for a failed save: its own message for the codes the
 * page knows, the generic one for anything else (another refusal included).
 */
export function qualitySettingsErrorKeyFor(error) {
  const response = (error && error.response) || {};
  const code = (response.data || {}).message;
  return Object.prototype.hasOwnProperty.call(MESSAGES, code)
    ? MESSAGES[code]
    : 'qualitySettings.snackbars.error';
}
