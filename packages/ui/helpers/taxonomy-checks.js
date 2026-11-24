/**
 * The points to check of a company's taxonomy (ADR-0026): what it lacks that
 * the application can tell, shown without ever blocking. Covered by
 * tests/ui/helpers/taxonomy-checks.test.js.
 *
 * - `missingCode`: a value of a dimension with a role, without its normalised
 *   code (ADR-0023);
 * - `nothingOffered`: a parent value under which no child value is offered;
 * - `noValue`: an active dimension with no active value;
 * - `tokenUnread`: a design token a value carries that no template reads;
 * - `dimensionUnread`: a dimension offered on the templates reading it, which
 *   no template reads;
 * - `literalNotCarried`: a literal a template compares a dimension against,
 *   which no value of it carries, deactivated ones included.
 *
 * Deactivated dimensions and values ask nothing; the trigger's values are the
 * doctrine's.
 */
import { STANDARD_DIMENSIONS } from './taxonomy-builder.js';
import { comparedLiterals } from '../../shared/taxonomy/compared-literals.js';

const ids = (list) => (list || []).map(String);
const plainTokens = (tokens) =>
  tokens instanceof Map ? Object.fromEntries(tokens) : tokens || {};
const readBy = (contract) =>
  new Set([
    ...Object.keys(contract?.declared || {}),
    ...(contract?.read || []),
  ]);

/**
 * @param {Object} params
 * @param {Object[]} params.dimensions
 * @param {Object[]} params.values
 * @param {Object[]} params.templates with their `contract`
 * @returns {Object[]} `{ kind, dimension, ... }`
 */
export function pointsToCheck({
  dimensions = [],
  values = [],
  templates = [],
}) {
  const active = dimensions.filter(
    (d) => d.isActive !== false && d.name !== STANDARD_DIMENSIONS.TRIGGER
  );
  const live = values.filter((value) => value.isActive !== false);
  const of = (name) => live.filter((value) => value.type === name);
  const readAll = new Set(templates.flatMap((t) => [...readBy(t.contract)]));
  const points = [];

  active.forEach((dimension) => {
    const own = of(dimension.name);
    if (!own.length)
      points.push({ kind: 'noValue', dimension: dimension.name });
    if (dimension.role) {
      own
        .filter((value) => !value.code)
        .forEach((value) =>
          points.push({
            kind: 'missingCode',
            dimension: dimension.name,
            valueId: String(value.id),
          })
        );
    }
    const parent = active.find((d) => d.name === dimension.parentName);
    if (parent) {
      of(parent.name).forEach((parentValue) => {
        const parentId = String(parentValue.id);
        const offered = own.some((value) => {
          const parents = ids(value._parents);
          return parents.length === 0 || parents.includes(parentId);
        });
        if (!offered) {
          points.push({
            kind: 'nothingOffered',
            dimension: dimension.name,
            parentValueId: parentId,
          });
        }
      });
    }
    const tokens = [
      ...new Set(
        own.flatMap((value) => Object.keys(plainTokens(value.tokens)))
      ),
    ];
    tokens
      .filter((token) => !readAll.has(token))
      .forEach((token) =>
        points.push({ kind: 'tokenUnread', dimension: dimension.name, token })
      );
    const read =
      readAll.has(dimension.name) || tokens.some((token) => readAll.has(token));
    if (dimension.scope === 'readingTemplates' && !read) {
      points.push({ kind: 'dimensionUnread', dimension: dimension.name });
    }
    // A deactivated value still exists, and emails still carry it.
    const all = values.filter((value) => value.type === dimension.name);
    points.push(...literalsNotCarried(dimension, all, templates));
  });
  return points;
}

function literalsNotCarried(dimension, own, templates) {
  const carried = new Set(own.map((value) => value.canonicalType));
  const comparing = new Map();
  templates.forEach((template) => {
    comparedLiterals(template.contract, dimension.name)
      .map((entry) => entry.literal)
      .filter((literal) => !carried.has(literal))
      .forEach((literal) => {
        if (!comparing.has(literal)) comparing.set(literal, []);
        comparing.get(literal).push(String(template.id));
      });
  });
  return [...comparing].map(([identifier, templateIds]) => ({
    kind: 'literalNotCarried',
    dimension: dimension.name,
    identifier,
    templateIds,
  }));
}

/**
 * @param {Object[]} points
 * @returns {Object<string, number>} the count per dimension, for the tree
 */
export function pointsByDimension(points = []) {
  return points.reduce((counts, point) => {
    counts[point.dimension] = (counts[point.dimension] || 0) + 1;
    return counts;
  }, {});
}
