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
      defaultUnder: [],
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
    defaultUnder: (item.defaultUnder || []).map(String),
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
  // The company's default (ADR-0024), never on the email type, which keeps its
  // own field on the email: ticked at the first level, under some parent
  // values for a child dimension.
  if (canBeDefault({ isEmailType })) {
    if (hasParent) {
      payload.defaultUnder = defaultUnderOffered(form);
    } else {
      payload.isDefault = form.isDefault === true;
    }
  }
  return payload;
}

export function canBeDefault({ isEmailType }) {
  return !isEmailType;
}

/**
 * The parent values a child value is the default under, kept to those its
 * availability offers it under: narrowing the availability takes the others.
 */
export function defaultUnderOffered({ defaultUnder, parentIds }) {
  const offered = parentIds || [];
  return (defaultUnder || []).filter(
    (id) => offered.length === 0 || offered.includes(id)
  );
}
