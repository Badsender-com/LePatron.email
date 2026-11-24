'use strict';

/**
 * Where an empty dimension of an email takes its value from (ADR-0024). One
 * rule, two readers: the server when an email is created, the editor when the
 * user changes a parent value.
 *
 * For a first-level dimension: the template's own default, the value its
 * contract declares for the property of the dimension's name, when a value
 * carries that identifier; then the company's default. Otherwise nothing: a
 * first-level dimension with a single value is not filled for it, a value is a
 * statement about the email.
 *
 * For a child dimension, among the values offered under the parent value: the
 * template's own, then the one "default under" that parent value, then the only
 * one offered. A child whose parent has no value, or is out of the email's
 * scope, takes nothing.
 *
 * Never retroactive: a value already chosen is kept, and only an email being
 * created, or the descendants of what the user just changed, are looked at.
 */
const { isOfferedUnder, inTreeOrder } = require('./availability.js');

module.exports = { resolveDefaults };

/**
 * @param {Object} params
 * @param {Array} params.dimensions with `name`, `parentName` and `values`, each
 *   value with `id`, `canonicalType`, `isActive`, `isDefault`, and for a child
 *   value `parentIds` and `defaultUnder`
 * @param {Object} params.selections dimension name → value id
 * @param {Object} [params.templateDefaults] property → identifier, the defaults
 *   the template's contract declares
 * @param {string[]} [params.changed] the dimensions the user just changed; absent
 *   for an email being created
 * @returns {Object} the selections, the empty dimensions filled where a default
 *   applies
 */
function resolveDefaults({
  dimensions,
  selections,
  templateDefaults,
  changed,
}) {
  const resolved = { ...(selections || {}) };
  const declared = templateDefaults || {};
  const all = dimensions || [];
  // An email being created: every dimension is looked at. Otherwise only the
  // descendants of what the user changed, the set growing as it goes down.
  const touched = changed ? new Set(changed) : null;

  inTreeOrder(all).forEach((dimension) => {
    const { parentName } = dimension;
    if (!parentName) {
      if (touched || resolved[dimension.name]) return;
      const value = firstLevelDefault(dimension, declared);
      if (value) resolved[dimension.name] = value.id;
      return;
    }
    if (touched && !touched.has(parentName)) return;

    const before = resolved[dimension.name];
    const value = childValue(dimension, resolved[parentName], before, declared);
    if (value) resolved[dimension.name] = value.id;
    else delete resolved[dimension.name];
    if (touched && String(resolved[dimension.name]) !== String(before)) {
      touched.add(dimension.name);
    }
  });
  return resolved;
}

function firstLevelDefault(dimension, templateDefaults) {
  const offered = (dimension.values || []).filter((value) => value.isActive);
  const identifier = templateDefaults[dimension.name];
  return (
    (identifier &&
      offered.find((value) => value.canonicalType === identifier)) ||
    offered.find((value) => value.isDefault) ||
    null
  );
}

const includesId = (ids, id) => (ids || []).map(String).includes(String(id));

/**
 * The value of a child dimension under `parentValue`: the one already chosen
 * while it is still offered, never moved; otherwise its default there.
 */
function childValue(dimension, parentValue, chosenId, templateDefaults) {
  if (!parentValue) return null;
  const offered = (dimension.values || []).filter(
    (value) => value.isActive && isOfferedUnder(value, parentValue)
  );
  const chosen = offered.find((value) => String(value.id) === String(chosenId));
  if (chosenId && chosen) return chosen;

  const identifier = templateDefaults[dimension.name];
  return (
    (identifier &&
      offered.find((value) => value.canonicalType === identifier)) ||
    offered.find((value) => includesId(value.defaultUnder, parentValue)) ||
    (offered.length === 1 ? offered[0] : null)
  );
}
