import * as apiRoutes from '~/helpers/api-routes.js';
import { ERROR_CODES } from '~/helpers/constants/error-codes.js';
import { safeFetchGroup } from '~/helpers/safe-fetch-group';
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

// FORBIDDEN_TECH_QUALITY_CHECK: a change to a check of the technical
// settings (TECH_CHECKS) by a user who cannot set them.
const MESSAGES = {
  [ERROR_CODES.FORBIDDEN_TECH_QUALITY_CHECK]:
    'qualitySettings.snackbars.forbidden',
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

/**
 * What the "Contrôle qualité" pages load: the group and its templates. A
 * list that cannot be read is a load error, never an empty list: "no
 * template" and "try again" lead to opposite acts.
 * @param {Object} nuxtContext the asyncData context, or the same keys
 * @returns {Promise<{ group: Object, templates: Object[], loadError: boolean }>}
 */
export async function loadQualitySettings(nuxtContext) {
  const [groupData, templates] = await Promise.all([
    safeFetchGroup(nuxtContext),
    nuxtContext.$axios
      .$get(apiRoutes.groupsItemTemplates(nuxtContext.params))
      .then((response) => response.items || [])
      .catch(() => null),
  ]);
  return {
    group: groupData.group,
    templates: templates || [],
    loadError: !groupData.group.id || templates === null,
  };
}
