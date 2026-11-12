/**
 * Pure helpers for the taxonomy screen's dimensions (ADR-0014).
 *
 * The screen's components stay thin: what it decides lives here, covered by
 * tests/ui/helpers/taxonomy-builder.test.js, since the project has no
 * `@vue/test-utils`.
 */

/**
 * The two standard dimensions, in the order the screen lists them, mirroring
 * `StandardDimensions` in packages/server/constant/taxonomy-type.js.
 */
export const STANDARD_DIMENSIONS = Object.freeze({
  EMAIL_TYPE: 'emailType',
  TRIGGER: 'trigger',
});

const STANDARD_ORDER = Object.freeze([
  STANDARD_DIMENSIONS.EMAIL_TYPE,
  STANDARD_DIMENSIONS.TRIGGER,
]);

/**
 * The trigger's two values, which are the doctrine's and not taxonomy items
 * (packages/server/constant/email-trigger.js). Shown read-only, with the i18n
 * key of their label and definition.
 */
export const TRIGGER_VALUES = Object.freeze([
  { value: 'adhoc', key: 'taxonomy.dimensions.trigger.adhoc' },
  { value: 'automated', key: 'taxonomy.dimensions.trigger.automated' },
]);

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
 * The bounds of a company's taxonomy, mirroring `TaxonomyLimits` in
 * packages/server/constant/taxonomy-type.js. Shown before the server refuses.
 */
export const DIMENSIONS_PER_COMPANY = 20;

// Mirrors `DIMENSION_NAME_PATTERN` server-side: a name a template reads as a
// property, `_root_.audience`.
const DIMENSION_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

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

/**
 * The dimensions `dimension` may hang under (ADR-0014): the active ones, the
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
 * The design tokens a value carries, as rows the form edits, and back. Rows
 * with no name are dropped on the way back; the server checks the rest.
 */
export const TOKENS_PER_VALUE = 24;

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
