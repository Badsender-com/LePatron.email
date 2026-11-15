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
import {
  isOfferedUnder,
  effectiveParentName,
} from '../../shared/taxonomy/availability.js';
import {
  firstLevelDefault,
  childValue,
} from '../../shared/taxonomy/default-values.js';

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

// A value as the editor's rules read it (shared/taxonomy/).
const asEditorValue = (value) => ({
  id: String(value.id),
  canonicalType: value.canonicalType,
  isActive: value.isActive !== false,
  isDefault: Boolean(value.isDefault),
  parentIds: ids(value._parents),
  defaultUnder: ids(value.defaultUnder),
});

function describe(dimension, { active, inScope, declared }) {
  const entry = { name: dimension.name, label: dimension.label };
  if (dimension.name === STANDARD_DIMENSIONS.TRIGGER) {
    return { ...entry, values: TRIGGER_VALUES.map((v) => v.value) };
  }
  const own = active
    .filter((value) => value.type === dimension.name)
    .map(asEditorValue);
  entry.values = own.map((value) => value.id);
  // The email type has no default (ADR-0024).
  if (dimension.name === STANDARD_DIMENSIONS.EMAIL_TYPE) return entry;

  const editorDimension = { name: dimension.name, values: own };
  // A parent out of the email's scope is not there: the child is offered
  // with all its values, and takes its default as a first-level one.
  const parentName = effectiveParentName(dimension, inScope);
  if (!parentName) {
    const chosen = firstLevelDefault(editorDimension, declared);
    if (chosen) entry.defaultValue = chosen.id;
    return entry;
  }
  entry.under = {};
  entry.defaultUnder = {};
  active
    .filter((value) => value.type === parentName)
    .forEach((parentValue) => {
      const parentId = String(parentValue.id);
      entry.under[parentId] = own
        .filter((value) => isOfferedUnder(value, parentId))
        .map((value) => value.id);
      const chosen = childValue(editorDimension, parentId, null, declared);
      if (chosen) entry.defaultUnder[parentId] = chosen.id;
    });
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
      describe(dimension, {
        active,
        inScope,
        declared: template?.contract?.declared || {},
      })
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
