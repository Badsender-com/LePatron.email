import { ERROR_CODES } from '~/helpers/constants/error-codes.js';

/**
 * Pure helpers for the taxonomy screens.
 *
 * They live here rather than inside the components for one practical reason: the
 * project has no `@vue/test-utils`, so anything left in a `.vue` file is untested.
 * Everything here is covered by tests/ui/helpers/taxonomy.test.js.
 */

/**
 * Bounds of the editable fields, mirroring `TaxonomyLimits` in
 * packages/server/constant/taxonomy-type.js. The form tells the user before the
 * request rather than letting a 400 do it.
 */
export const TAXONOMY_LIMITS = Object.freeze({
  LABEL: 120,
  DESCRIPTION: 2000,
  CANONICAL_TYPE: 60,
});

/**
 * The AI skills vocabulary a company may map its own typology onto. Mirrors
 * `EmailTypeCanonical` in packages/server/constant/email-type-canonical.js.
 *
 * Neither side constrains the stored value: this list evolves with the skills,
 * which already fall back on the raw string. Hence `canonicalTypeLabelKey` below.
 */
export const CANONICAL_TYPES = Object.freeze([
  'promo',
  'newsletter',
  'transactional',
]);

/**
 * The i18n key for a canonical type, or null when the value is not one we know.
 *
 * The server accepts any string here on purpose, so a value coming from an import
 * or from a newer skills vocabulary must not surface as `taxonomy.canonicalTypes.
 * lifecycle` in front of a user — the caller shows the raw value instead.
 *
 * @param {string} canonicalType
 * @returns {string|null}
 */
export function canonicalTypeLabelKey(canonicalType) {
  if (!canonicalType || !CANONICAL_TYPES.includes(canonicalType)) return null;
  return `taxonomy.canonicalTypes.${canonicalType}`;
}

/**
 * Maps a failed request onto what the user should read.
 *
 * A raw server message is never shown: it is an error code, or an English
 * developer sentence, neither of which is translated.
 *
 * @param {Error} error an axios error
 * @returns {{ key: string, params: Object, count: number|null, field: string|null }}
 *   `field` names the form field the message belongs next to, when there is one.
 */
export function taxonomyErrorFor(error) {
  const data = (error && error.response && error.response.data) || {};
  const generic = {
    key: 'global.errors.errorOccured',
    params: {},
    count: null,
    field: null,
  };

  switch (data.message) {
    case ERROR_CODES.TAXONOMY_ITEM_LABEL_ALREADY_EXISTS:
      // Belongs next to the field the user must change, not in a snackbar at the
      // bottom of the screen while the offending input sits at the top.
      return {
        key: 'taxonomy.errors.labelAlreadyExists',
        params: {},
        count: null,
        field: 'label',
      };

    case ERROR_CODES.TAXONOMY_ITEM_IN_USE: {
      const count = (data.details && data.details.usageCount) || 0;
      return {
        key: 'taxonomy.errors.inUse',
        params: { count },
        count,
        field: null,
      };
    }

    case ERROR_CODES.TAXONOMY_LIMIT_REACHED:
      return {
        key: 'taxonomy.errors.limitReached',
        params: {},
        count: null,
        field: null,
      };

    default:
      return generic;
  }
}

/**
 * Maps a failed company-settings save onto a translated message.
 *
 * @param {Error} error an axios error
 * @returns {string} an i18n key
 */
export function emailMetadataErrorKeyFor(error) {
  const data = (error && error.response && error.response.data) || {};

  if (data.message === ERROR_CODES.INVALID_EMAIL_METADATA) {
    return 'emailBuilderSettings.snackbars.invalid';
  }

  return 'emailBuilderSettings.snackbars.error';
}

/**
 * The order to pre-fill on a new item: after the last one, so successive
 * creations keep the order the admin created them in instead of all landing on 0
 * and falling back to an alphabetical tie-break.
 *
 * @param {Array} items existing items
 * @returns {number}
 */
export function nextOrder(items = []) {
  const orders = items
    .map((item) => item && item.order)
    .filter((order) => typeof order === 'number' && Number.isFinite(order));

  if (orders.length === 0) return 0;

  return Math.max(...orders) + 1;
}

/**
 * The payload for a create or an update, from the form state.
 *
 * `null` rather than `''` on the optional text fields: the server reads both as
 * "clear it", but `null` says so.
 *
 * @param {Object} form
 * @returns {Object}
 */
export function buildTaxonomyPayload(form) {
  return {
    label: String(form.label || '').trim(),
    description: form.description ? form.description : null,
    canonicalType: form.canonicalType || null,
    isActive: form.isActive !== false,
    order: Number(form.order) || 0,
  };
}
