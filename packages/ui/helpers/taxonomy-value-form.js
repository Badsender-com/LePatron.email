import { buildTaxonomyPayload } from '~/helpers/taxonomy.js';

/**
 * The form of the value dialog, and the body it sends: kept apart from the
 * dialog so the fields each kind of dimension sends are testable.
 */

/**
 * @param {Object|null} item the value to edit, or null to create one
 * @param {number} [suggestedOrder] pre-filled order for a new value
 * @returns {Object} the form state
 */
export function valueFormFor(item, suggestedOrder = 0) {
  if (!item) {
    return {
      label: '',
      description: '',
      canonicalType: null,
      isActive: true,
      order: suggestedOrder,
      parentIds: [],
      tokens: {},
      code: null,
      isDefault: false,
    };
  }
  return {
    label: item.label || '',
    description: item.description || '',
    canonicalType: item.canonicalType || null,
    isActive: item.isActive !== false,
    order: typeof item.order === 'number' ? item.order : 0,
    parentIds: (item._parents || []).map(String),
    tokens: { ...(item.tokens || {}) },
    code: item.code || null,
    isDefault: item.isDefault === true,
  };
}

/**
 * @param {Object} form
 * @param {Object} dimension what the dimension makes a value carry
 * @param {boolean} dimension.isEmailType the email type has no tokens
 * @param {boolean} dimension.hasParent its values carry an availability
 * @param {string|null} dimension.role its values carry a code
 * @returns {Object} the body of the request
 */
export function valuePayloadFrom(form, { isEmailType, hasParent, role }) {
  const payload = buildTaxonomyPayload(form);
  if (hasParent) payload.parentIds = form.parentIds;
  payload.tokens = form.tokens;
  if (role) payload.code = form.code;
  // The company's default: first-level dimensions only, never the email type,
  // which keeps its own field on the email (ADR-0024).
  if (canBeDefault({ isEmailType, hasParent })) {
    payload.isDefault = form.isDefault === true;
  }
  return payload;
}

export function canBeDefault({ isEmailType, hasParent }) {
  return !isEmailType && !hasParent;
}
