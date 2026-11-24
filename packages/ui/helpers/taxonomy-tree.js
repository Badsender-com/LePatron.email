/**
 * The tree of dimensions on the left of the taxonomy workspace, the segments of
 * the selected dimension, and what the URL selects (ADR-0026). Pure helpers,
 * covered by tests/ui/helpers/taxonomy-tree.test.js.
 */
import { STANDARD_DIMENSIONS, TRIGGER_VALUES } from './taxonomy-builder.js';

const STANDARD_ORDER = [
  STANDARD_DIMENSIONS.EMAIL_TYPE,
  STANDARD_DIMENSIONS.TRIGGER,
];

const bySiblingOrder = (a, b) =>
  (a.order || 0) - (b.order || 0) ||
  String(a.label || '').localeCompare(String(b.label || ''));

const countOf = (dimension, values) =>
  dimension.name === STANDARD_DIMENSIONS.TRIGGER
    ? TRIGGER_VALUES.length
    : values.filter((value) => value.type === dimension.name).length;

const rowOf = (dimension, depth, values) => ({
  kind: 'dimension',
  id: dimension.id,
  name: dimension.name,
  label: dimension.label,
  parentName: dimension.parentName || null,
  depth,
  locked: !!dimension.standard,
  inactive: dimension.isActive === false,
  count: countOf(dimension, values),
});

/**
 * The rows of the tree: a section of standard dimensions, locked and in the
 * doctrine's order, then the company's, each followed by its children.
 * Siblings follow their order, then their label.
 *
 * @param {Object} params
 * @param {Object[]} params.dimensions
 * @param {Object[]} params.values with `type`, counted per dimension
 * @returns {Object[]} `{ kind: 'section', key }` and `{ kind: 'dimension',
 *   name, label, depth, locked, inactive, count }`
 */
export function dimensionTree({ dimensions = [], values = [] }) {
  const standard = STANDARD_ORDER.map((name) =>
    dimensions.find((dimension) => dimension.name === name)
  ).filter(Boolean);
  const company = dimensions.filter((dimension) => !dimension.standard);
  const known = new Set(company.map((dimension) => dimension.name));
  const childrenOf = (parentName) =>
    company
      .filter((dimension) =>
        parentName === null
          ? !dimension.parentName || !known.has(dimension.parentName)
          : dimension.parentName === parentName
      )
      .sort(bySiblingOrder);

  const rows = [{ kind: 'section', key: 'standard' }];
  standard.forEach((dimension) => rows.push(rowOf(dimension, 0, values)));
  rows.push({ kind: 'section', key: 'company' });
  const visit = (dimension, depth, seen) => {
    if (seen.has(dimension.name)) return;
    seen.add(dimension.name);
    rows.push(rowOf(dimension, depth, values));
    childrenOf(dimension.name).forEach((child) =>
      visit(child, depth + 1, seen)
    );
  };
  const seen = new Set();
  childrenOf(null).forEach((dimension) => visit(dimension, 0, seen));
  return rows;
}

const SEGMENTS_OF_A_DIMENSION = ['tokens', 'templates', 'settings'];

/**
 * The segments of a dimension: its values, then its crossings for a child or
 * its default for a first-level one, its tokens, its templates and its
 * settings. The trigger's values are the doctrine's: nothing else to set.
 *
 * @param {Object} dimension
 * @returns {string[]}
 */
export function segmentsOf(dimension) {
  if (!dimension) return ['values'];
  if (dimension.name === STANDARD_DIMENSIONS.TRIGGER) return ['values'];
  // The email type has no default (ADR-0024).
  if (dimension.name === STANDARD_DIMENSIONS.EMAIL_TYPE) {
    return ['values', ...SEGMENTS_OF_A_DIMENSION];
  }
  return [
    'values',
    dimension.parentName ? 'crossings' : 'defaults',
    ...SEGMENTS_OF_A_DIMENSION,
  ];
}

/**
 * What the URL selects: `?dimension=language&tab=crossings`. An unknown
 * dimension falls back to the first of the tree, a segment the dimension does
 * not have to its values.
 *
 * @param {Object} params
 * @param {Object[]} params.dimensions
 * @param {Object} [params.query] the route's query
 * @param {string[]} [params.available] the segments the screen shows, when it
 *   shows fewer than a dimension has
 * @returns {{dimension: string, tab: string}}
 */
export function workspaceSelection({ dimensions = [], query = {}, available }) {
  const first = dimensionTree({ dimensions }).find(
    (row) => row.kind === 'dimension'
  );
  const dimension =
    dimensions.find((candidate) => candidate.name === query.dimension) ||
    dimensions.find((candidate) => candidate.name === first?.name) ||
    null;
  const segments = segmentsOf(dimension).filter(
    (segment) => !available || available.includes(segment)
  );
  return {
    dimension: dimension ? dimension.name : null,
    tab: segments.includes(query.tab) ? query.tab : 'values',
  };
}
