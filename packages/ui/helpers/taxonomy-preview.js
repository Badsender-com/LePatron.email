/**
 * What an email of a template proposes (ADR-0024, ADR-0026): the dimensions
 * in its scope, their values, under which parent value each child value is
 * offered, the defaults, and the design tokens it reads that a value carries.
 * The editor's rules, read on the taxonomy workspace so the tech admin checks
 * the taxonomy against a real template. Covered by
 * tests/ui/helpers/taxonomy-preview.test.js.
 */
import { STANDARD_DIMENSIONS, TRIGGER_VALUES } from './taxonomy-builder.js';
import { dimensionTree } from './taxonomy-tree.js';

const ids = (list) => (list || []).map(String);
const plainTokens = (tokens) =>
  tokens instanceof Map ? Object.fromEntries(tokens) : tokens || {};

const readBy = (contract) =>
  new Set([
    ...Object.keys(contract?.declared || {}),
    ...(contract?.read || []),
  ]);

/**
 * Whether a template reads a dimension: it names it, or reads a design token
 * one of its values carries. A dimension of scope "every email" always is.
 */
function isInScope(dimension, values, read) {
  if (dimension.scope !== 'readingTemplates') return true;
  if (read.has(dimension.name)) return true;
  return values
    .filter((value) => value.type === dimension.name)
    .some((value) =>
      Object.keys(plainTokens(value.tokens)).some((token) => read.has(token))
    );
}

const offeredUnder = (value, parentId) => {
  const parents = ids(value._parents);
  return parents.length === 0 || parents.includes(parentId);
};

function describe(dimension, { active, inScope, template, byName }) {
  if (dimension.name === STANDARD_DIMENSIONS.TRIGGER) {
    return {
      name: dimension.name,
      label: dimension.label,
      values: TRIGGER_VALUES.map((v) => v.value),
    };
  }
  const own = active.filter((value) => value.type === dimension.name);
  const parent = dimension.parentName && byName[dimension.parentName];
  const entry = {
    name: dimension.name,
    label: dimension.label,
    values: own.map((value) => String(value.id)),
  };
  if (parent && inScope.has(parent.name)) {
    const parentValues = active.filter((value) => value.type === parent.name);
    entry.under = {};
    entry.defaultUnder = {};
    parentValues.forEach((parentValue) => {
      const parentId = String(parentValue.id);
      const offered = own.filter((value) => offeredUnder(value, parentId));
      entry.under[parentId] = offered.map((value) => String(value.id));
      const holder = offered.find((value) =>
        ids(value.defaultUnder).includes(parentId)
      );
      if (holder) entry.defaultUnder[parentId] = String(holder.id);
    });
    return entry;
  }
  if (!parent) {
    // The template's own default first, then the company's (ADR-0024).
    const declared = (template?.contract?.declared || {})[dimension.name];
    const byTemplate = own.find(
      (value) => declared && value.canonicalType === declared
    );
    const byCompany = own.find((value) => value.isDefault);
    const chosen = byTemplate || byCompany;
    if (chosen) entry.defaultValue = String(chosen.id);
  }
  return entry;
}

/**
 * @param {Object} params
 * @param {Object} params.template with its `contract`
 * @param {Object[]} params.dimensions
 * @param {Object[]} params.values
 * @returns {{dimensions: Object[], tokens: string[]}}
 */
export function valuesProposed({ template, dimensions = [], values = [] }) {
  const read = readBy(template?.contract);
  const active = values.filter((value) => value.isActive !== false);
  const byName = Object.fromEntries(dimensions.map((d) => [d.name, d]));
  const ordered = dimensionTree({ dimensions })
    .filter((row) => row.kind === 'dimension')
    .map((row) => byName[row.name])
    .filter((dimension) => dimension.isActive !== false);
  const kept = ordered.filter((dimension) =>
    isInScope(dimension, active, read)
  );
  const inScope = new Set(kept.map((dimension) => dimension.name));
  const carried = new Set(
    active
      .filter((value) => inScope.has(value.type))
      .flatMap((value) => Object.keys(plainTokens(value.tokens)))
  );
  return {
    dimensions: kept.map((dimension) =>
      describe(dimension, { active, inScope, template, byName })
    ),
    tokens: [...carried].filter((token) => read.has(token)).sort(),
  };
}

/**
 * The templates that read a dimension: they name it, or read a design token
 * one of its values carries.
 *
 * @param {Object} params
 * @param {Object} params.dimension
 * @param {Object[]} params.templates with their `contract`
 * @param {Object[]} params.values
 * @returns {Object[]} the templates, in the order given
 */
export function templatesReading({ dimension, templates = [], values = [] }) {
  const tokens = values
    .filter((value) => value.type === dimension.name)
    .flatMap((value) => Object.keys(plainTokens(value.tokens)));
  return templates.filter((template) => {
    const read = readBy(template.contract);
    return read.has(dimension.name) || tokens.some((token) => read.has(token));
  });
}
