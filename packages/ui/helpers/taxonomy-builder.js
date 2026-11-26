/**
 * Pure helpers for the taxonomy screen's dimensions (ADR-0032).
 *
 * The screen's components stay thin: what it decides lives here, covered by
 * tests/ui/helpers/taxonomy-builder.test.js, since the project has no
 * `@vue/test-utils`.
 */

import {
  STANDARD_DIMENSIONS,
  EMAIL_TRIGGER_VALUES,
  DIMENSION_NAME_PATTERN,
  TAXONOMY_LIMITS,
} from '../../shared/taxonomy/constants.js';

/**
 * The two standard dimensions, in the order the screen lists them, and the
 * bounds of a company's taxonomy: the server's own
 * (packages/shared/taxonomy/constants.js).
 */
export { STANDARD_DIMENSIONS };

export const DIMENSIONS_PER_COMPANY = TAXONOMY_LIMITS.DIMENSIONS_PER_COMPANY;

const STANDARD_ORDER = Object.freeze([
  STANDARD_DIMENSIONS.EMAIL_TYPE,
  STANDARD_DIMENSIONS.TRIGGER,
]);

/**
 * The trigger's two values, which are the doctrine's and not taxonomy items.
 * Shown read-only, with the i18n key of their label and definition.
 */
export const TRIGGER_VALUES = Object.freeze(
  EMAIL_TRIGGER_VALUES.map((value) =>
    Object.freeze({ value, key: `taxonomy.dimensions.trigger.${value}` })
  )
);

const rankOf = (dimension) => {
  const standardRank = STANDARD_ORDER.indexOf(dimension.name);
  return standardRank === -1 ? STANDARD_ORDER.length : standardRank;
};

/**
 * The standard dimensions first, whatever their order, then the company's in
 * their declared order, then by label.
 *
 * @param {Object[]} dimensions
 * @returns {Object[]} a sorted copy
 */
export function sortDimensions(dimensions = []) {
  return [...dimensions].sort(
    (a, b) =>
      rankOf(a) - rankOf(b) ||
      (a.order || 0) - (b.order || 0) ||
      String(a.label || '').localeCompare(String(b.label || ''))
  );
}

/**
 * What the screen offers on a dimension.
 *
 * - No dimension is ever renamed: its name is what templates read (ADR-0015).
 * - A standard dimension is neither deactivated nor deleted.
 * - A dimension with values is deactivated rather than deleted.
 * - The trigger's values are the doctrine's: shown, never edited.
 *
 * @param {Object} dimension
 * @param {Object} options
 * @param {number} options.valueCount how many values the dimension has
 * @returns {{canRename: boolean, canDeactivate: boolean, canDelete: boolean,
 *   canEditValues: boolean}}
 */
export function dimensionActions(dimension, { valueCount = 0 } = {}) {
  const standard = Boolean(dimension.standard);

  return {
    canRename: false,
    canDeactivate: !standard,
    canDelete: !standard && valueCount === 0,
    canEditValues: dimension.name !== STANDARD_DIMENSIONS.TRIGGER,
  };
}

/**
 * The payload of a dimension's wording, from the form state. The name never
 * travels: it is write-once.
 *
 * @param {Object} form
 * @returns {{label: string, description: (string|null)}}
 */
export function buildDimensionPayload(form) {
  return {
    label: String(form.label || '').trim(),
    description: form.description ? form.description : null,
  };
}

/**
 * Whether a template could read this name as a property. Checked in the form
 * so the admin learns it before saving, not from a 400.
 *
 * @param {*} name
 * @returns {boolean}
 */
export function isValidDimensionName(name) {
  return typeof name === 'string' && DIMENSION_NAME_PATTERN.test(name);
}

/**
 * The identifier proposed for a value, from its label: lower case, accents
 * dropped, words joined by hyphens. Only a proposal: the admin may change it.
 *
 * @param {string} label
 * @returns {string} empty when the label holds no letter or digit
 */
export function proposeIdentifier(label) {
  return String(label || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * The payload declaring a dimension. The name travels this once, and never
 * again: it is write-once (ADR-0015).
 *
 * @param {Object} form
 * @returns {{name: string, label: string, description: (string|null)}}
 */
export function buildNewDimensionPayload(form) {
  return {
    name: String(form.name || '').trim(),
    ...buildDimensionPayload(form),
  };
}
