'use strict';

/**
 * Adoption (ADR-0024): an email with no value for a dimension takes the value
 * its content already holds. Read in the template property of the dimension's
 * name, or in the source the template contract declares for it, depending on
 * the parent (`brand_[silo]`, `[silo]` being the identifier of the email's
 * silo). Parents are adopted before their children, so that a child reads the
 * source of its own parent value and never what another one left behind.
 *
 * What cannot be adopted is reported, never guessed: an identifier no value
 * carries, or a value not offered under the parent value. The rest of the
 * order (shared/taxonomy/default-values.js) then applies.
 *
 * One rule, two readers: the editor when an email opens, the server when a
 * template's emails are adopted in bulk.
 */
const UNKNOWN_IDENTIFIER = 'UNKNOWN_IDENTIFIER';
const NOT_OFFERED = 'NOT_OFFERED';

module.exports = { adoptValues, UNKNOWN_IDENTIFIER, NOT_OFFERED };

// `[silo]` in a source: the identifier of the value the email has for `silo`.
const PLACEHOLDER = /\[([A-Za-z0-9_-]+)\]/g;

/**
 * @param {Object} params
 * @param {Array} params.dimensions with `name`, `parentName` and `values`, each
 *   value with `id`, `canonicalType`, `isActive` and `parentIds`
 * @param {Object} [params.contract] the template contract, its `adopt` mapping a
 *   dimension to its source
 * @param {Object} params.content the root properties of the email's content,
 *   name → value
 * @param {Object} [params.selections] dimension name → value id, what the email
 *   carries; never replaced
 * @returns {{selections: Object, adopted: string[], gaps: Array<{dimension: string, identifier: string, reason: string}>}}
 */
function adoptValues({ dimensions, contract, content, selections }) {
  const all = dimensions || [];
  const sources = (contract && contract.adopt) || {};
  const result = {
    selections: { ...(selections || {}) },
    adopted: [],
    gaps: [],
  };
  const byName = new Map(all.map((dimension) => [dimension.name, dimension]));

  inTreeOrder(all).forEach((dimension) => {
    if (result.selections[dimension.name]) return;

    const source = sourceOf(
      sources[dimension.name] || dimension.name,
      byName,
      result.selections
    );
    const identifier = source && (content || {})[source];
    if (typeof identifier !== 'string' || identifier.trim() === '') return;

    // The email type is a parent sent apart, its value in the selections.
    const parentName =
      byName.has(dimension.parentName) ||
      (dimension.parentName && result.selections[dimension.parentName])
        ? dimension.parentName
        : null;
    const parentValue = parentName && result.selections[parentName];
    // A child waits for its parent: offered under nothing, it cannot be told
    // whether the content's value is a combination the company allows.
    if (parentName && !parentValue) return;

    const value = (dimension.values || []).find(
      (candidate) => candidate.canonicalType === identifier
    );
    if (!value) {
      result.gaps.push(gap(dimension, identifier, UNKNOWN_IDENTIFIER));
      return;
    }
    if (!value.isActive || (parentName && !offeredUnder(value, parentValue))) {
      result.gaps.push(gap(dimension, identifier, NOT_OFFERED));
      return;
    }
    result.selections[dimension.name] = value.id;
    result.adopted.push(dimension.name);
  });
  return result;
}

const gap = (dimension, identifier, reason) => ({
  dimension: dimension.name,
  identifier,
  reason,
});

/**
 * The property a source names once its placeholders read the identifiers of
 * the values already adopted; null while one of them has no value.
 */
function sourceOf(template, byName, selections) {
  let missing = false;
  const source = template.replace(PLACEHOLDER, (match, name) => {
    const dimension = byName.get(name);
    const value =
      dimension &&
      (dimension.values || []).find(
        (candidate) => String(candidate.id) === String(selections[name])
      );
    if (!value || !value.canonicalType) {
      missing = true;
      return match;
    }
    return value.canonicalType;
  });
  return missing ? null : source;
}

function offeredUnder(value, parentValue) {
  const parentIds = (value.parentIds || []).map(String);
  return parentIds.length === 0 || parentIds.includes(String(parentValue));
}

// Parents before their children; a dimension under one not sent comes last.
function inTreeOrder(dimensions) {
  const ordered = [];
  const place = (parentName) =>
    dimensions
      .filter((dimension) => (dimension.parentName || null) === parentName)
      .forEach((dimension) => {
        ordered.push(dimension);
        place(dimension.name);
      });
  place(null);
  return ordered.concat(
    dimensions.filter((dimension) => !ordered.includes(dimension))
  );
}
