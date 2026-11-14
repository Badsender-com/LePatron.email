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
 * Never retroactive: a value already chosen is kept, and only an email being
 * created, or the descendants of what the user just changed, are looked at.
 */
module.exports = { resolveDefaults };

/**
 * @param {Object} params
 * @param {Array} params.dimensions with `name`, `parentName` and `values`, each
 *   value with `id`, `canonicalType`, `isActive` and `isDefault`
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
  // A first-level dimension descends from nothing the user can change.
  if (changed) return resolved;

  (dimensions || [])
    .filter((dimension) => !dimension.parentName)
    .forEach((dimension) => {
      if (resolved[dimension.name]) return;
      const value = firstLevelDefault(dimension, templateDefaults || {});
      if (value) resolved[dimension.name] = value.id;
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
