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
 * The panel edits what a value is (ADR-0026): its words, identifier, code,
 * tokens and status. Where it is offered and where it is the default are set
 * in one place each, the crossings matrix and the Defaults segment, and its
 * order by drag and drop: none of them travels with the panel. A new value
 * goes last, offered everywhere.
 *
 * @param {Object} form
 * @param {Object} options
 * @param {string|null} options.role the dimension's role: its values carry a
 *   code
 * @param {boolean} options.isNew a creation, which gets its place in the list
 * @returns {Object} the body of the request
 */
export function valuePayloadFrom(form, { role, isNew }) {
  const { order, ...payload } = buildTaxonomyPayload(form);
  if (isNew) payload.order = order;
  payload.tokens = form.tokens;
  if (role) payload.code = form.code;
  return payload;
}
