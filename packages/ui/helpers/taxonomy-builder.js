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
  RESERVED_TOKEN_NAMES,
  TAXONOMY_LIMITS,
  isTokenValue,
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
 * Whether the name is reserved (RESERVED_DIMENSION_NAMES), though a template
 * could read it: one every JavaScript object already answers to (`__proto__`,
 * `constructor`, `toString`…), under which an email's value would be lost or
 * read back as an inherited function; or a piece of the content the editor
 * builds itself (`type`, `theme`, `mainBlocks`, `customStyle`), which
 * publishing the dimension would overwrite.
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

/**
 * The dimensions `dimension` may hang under (ADR-0032): the active ones, the
 * email type included, never the trigger (its values are not stored), the
 * dimension itself or one of its descendants, which would make a cycle.
 *
 * @param {Object[]} dimensions every dimension of the company
 * @param {Object} dimension the one being placed; `{}` for a new one
 * @returns {string[]} their names, in screen order
 */
export function parentCandidates(dimensions = [], dimension = {}) {
  const byName = new Map(dimensions.map((d) => [d.name, d]));
  const descendsFrom = (candidate) => {
    const seen = new Set();
    for (let at = candidate; at && !seen.has(at.name); ) {
      if (at.name === dimension.name) return true;
      seen.add(at.name);
      at = byName.get(at.parentName);
    }
    return false;
  };

  return sortDimensions(dimensions)
    .filter(
      (candidate) =>
        candidate.isActive &&
        candidate.name !== STANDARD_DIMENSIONS.TRIGGER &&
        candidate.name !== dimension.name &&
        !descendsFrom(candidate)
    )
    .map((candidate) => candidate.name);
}

/**
 * The order design tokens are resolved in, the last one winning: by precedence,
 * a tie broken by the screen's order, the way the editor resolves them
 * (packages/editor/src/js/utils/governance-values.js). The trigger carries no
 * token and is left out, like deactivated dimensions.
 *
 * @param {Object[]} dimensions
 * @returns {string[]} their names
 */
export function resolutionOrder(dimensions = []) {
  return sortDimensions(dimensions)
    .map((dimension, index) => ({ dimension, index }))
    .filter(
      ({ dimension }) =>
        dimension.isActive && dimension.name !== STANDARD_DIMENSIONS.TRIGGER
    )
    .sort(
      (a, b) =>
        (a.dimension.precedence || 0) - (b.dimension.precedence || 0) ||
        a.index - b.index
    )
    .map(({ dimension }) => dimension.name);
}

/**
 * The bounds of a value's design tokens: the server's
 * (packages/shared/taxonomy/constants.js).
 */
export const TOKENS_PER_VALUE = TAXONOMY_LIMITS.TOKENS_PER_VALUE;
export const TOKEN_NAME_MAX_LENGTH = TAXONOMY_LIMITS.DIMENSION_NAME;
export const TOKEN_VALUE_MAX_LENGTH = TAXONOMY_LIMITS.TOKEN_VALUE;

/**
 * The design tokens a value carries, as rows the form edits, and back. Rows
 * with no name are dropped on the way back; tokenRowErrors says what is wrong
 * with the others before they are sent.
 */
export function tokenRows(tokens = {}) {
  return Object.entries(tokens || {}).map(([name, value]) => ({ name, value }));
}

export function tokensFromRows(rows = []) {
  return Object.fromEntries(
    rows
      .map((row) => [String(row.name || '').trim(), String(row.value || '')])
      .filter(([name]) => name !== '')
  );
}

/**
 * What the server would refuse in the rows of the token form, said row by row
 * before anything is sent. A row left entirely empty is no token and no error:
 * it is dropped. Two rows of the same name would merge into one token: both
 * are flagged. Whether a name is one of the company's dimensions only the
 * server knows.
 *
 * @param {Array<{name: string, value: string}>} rows
 * @returns {Array<{name: string|null, value: string|null}>} for each row, the
 *   reason its name and its value are refused: `required`, `invalid`,
 *   `tooLong`, `reserved` or `duplicate` for a name; `required`, `tooLong` or
 *   `unsafe` for a value; null when fine
 */
export function tokenRowErrors(rows = []) {
  const names = rows.map((row) => String(row.name || '').trim());
  const count = names.reduce(
    (counts, name) => ({ ...counts, [name]: (counts[name] || 0) + 1 }),
    {}
  );
  return rows.map((row, index) => {
    const name = names[index];
    const value = String(row.value || '');
    if (name === '' && value.trim() === '') return { name: null, value: null };
    return {
      name: tokenNameError(name, count[name]),
      value: tokenValueError(value),
    };
  });
}

function tokenNameError(name, occurrences) {
  if (name === '') return 'required';
  if (!DIMENSION_NAME_PATTERN.test(name)) return 'invalid';
  if (name.length > TOKEN_NAME_MAX_LENGTH) return 'tooLong';
  if (RESERVED_TOKEN_NAMES.includes(name)) return 'reserved';
  if (occurrences > 1) return 'duplicate';
  return null;
}

function tokenValueError(value) {
  if (value.trim() === '') return 'required';
  if (value.length > TOKEN_VALUE_MAX_LENGTH) return 'tooLong';
  if (!isTokenValue(value)) return 'unsafe';
  return null;
}
