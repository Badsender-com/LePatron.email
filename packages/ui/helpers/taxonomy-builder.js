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
  RESERVED_DIMENSION_NAMES,
  TAXONOMY_LIMITS,
} from '../../shared/taxonomy/constants.js';
import { compareDimensions } from '../../shared/taxonomy/sort.js';

/**
 * The two standard dimensions, in the order the screen lists them, and the
 * bounds of a company's taxonomy: the server's own
 * (packages/shared/taxonomy/constants.js).
 */
export { STANDARD_DIMENSIONS };

export const DIMENSIONS_PER_COMPANY = TAXONOMY_LIMITS.DIMENSIONS_PER_COMPANY;

/**
 * The trigger's two values, which are the doctrine's and not taxonomy items.
 * Shown read-only, with the i18n key of their label and definition.
 */
export const TRIGGER_VALUES = Object.freeze(
  EMAIL_TRIGGER_VALUES.map((value) =>
    Object.freeze({ value, key: `taxonomy.dimensions.trigger.${value}` })
  )
);

/**
 * The dimensions in the one order the server's listing and the editor share
 * (packages/shared/taxonomy/sort.js): by their order, then the first declared
 * first. The standard dimensions are seeded at 10 and 20 and a new dimension
 * takes the next order, so they come first until the company reorders them.
 *
 * @param {Object[]} dimensions
 * @returns {Object[]} a sorted copy
 */
export function sortDimensions(dimensions = []) {
  return [...dimensions].sort(compareDimensions);
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

// Letters NFD does not split into a base letter and an accent, written as
// they are spelled out in ASCII rather than dropped: « Œuvre » proposes
// `oeuvre`, « Straße » `strasse`. Lower case only: the label is lowered first.
const SPELLED_OUT = Object.freeze({
  œ: 'oe',
  æ: 'ae',
  ß: 'ss',
  ø: 'o',
  ł: 'l',
  đ: 'd',
  ð: 'd',
  þ: 'th',
  ħ: 'h',
  ı: 'i',
  ĳ: 'ij',
  ŀ: 'l',
  ŋ: 'ng',
  ŧ: 't',
});
const SPELLED_OUT_PATTERN = new RegExp(
  `[${Object.keys(SPELLED_OUT).join('')}]`,
  'g'
);

/**
 * Whether the name is one every JavaScript object already answers to
 * (`__proto__`, `constructor`, `toString`…, see RESERVED_DIMENSION_NAMES),
 * though a template could read it: an email's value under it would be lost,
 * or read back as an inherited function.
 *
 * @param {*} name
 * @returns {boolean}
 */
export function isReservedDimensionName(name) {
  return RESERVED_DIMENSION_NAMES.includes(name);
}

/**
 * The identifier proposed for a value, from its label: lower case, accents
 * dropped, words joined by hyphens, cut to the identifier's length so the
 * server never refuses a proposal. Only a proposal: the admin may change it.
 *
 * @param {string} label
 * @returns {string} empty when the label holds no letter or digit
 */
export function proposeIdentifier(label) {
  return String(label || '')
    .toLowerCase()
    .replace(SPELLED_OUT_PATTERN, (letter) => SPELLED_OUT[letter])
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, TAXONOMY_LIMITS.CANONICAL_TYPE)
    .replace(/-+$/, '');
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
