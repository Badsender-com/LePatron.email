'use strict';

const {
  composeLocale,
} = require('../../../../shared/locale/locale-codes.js');

/**
 * What the editor publishes to the template for one email (ADR-0015): each
 * active dimension under its name, the property a template reads
 * (`_root_.audience`), valued by the identifier of the chosen value; and the
 * design tokens of the chosen values under their own names. When two chosen
 * values carry the same token, the dimension with the highest precedence wins,
 * and on a tie the later one in the declared order. The email's locale is
 * published under `locale` (ADR-0023), by the rule the server applies.
 *
 * Pure, like the rest of the section's helpers: the editor has no component test
 * harness. Covered by tests/editor/governance-values.test.js.
 */

/**
 * @param {Object} params
 * @param {Array} params.dimensions `{name, isActive, precedence, values: [{id,
 *   canonicalType, tokens}]}`, the email type among them, in the declared order
 * @param {Object} params.selections dimension name → chosen value id
 * @param {string} [params.trigger] the email's trigger
 * @returns {{values: Object, sources: Object}} `values` maps a template property
 *   to what it receives; `sources` says, for each token, which dimension it
 *   came from and which ones it overrode
 */
function governanceValues({ dimensions, selections, trigger }) {
  const values = { trigger: trigger || '' };
  const carriers = [];

  // The server sends active dimensions only; the flag is read for the
  // dimensions it may still send deactivated.
  const active = (dimensions || []).filter(
    (dimension) => dimension.isActive !== false
  );
  active.forEach((dimension, index) => {
    const chosen = selections && selections[dimension.name];
    // Defined even when empty, so `_root_.audience eq 'vip'` evaluates to
    // false instead of failing.
    if (!chosen) {
      values[dimension.name] = '';
      return;
    }
    const value = (dimension.values || []).find(
      (option) => String(option.id) === String(chosen)
    );
    // A value the editor was not sent cannot be named: the template keeps what
    // it has rather than being rewritten to nothing.
    if (!value) return;
    // A value with no identifier is published under its id: stable, and never
    // mistaken for no value at all.
    values[dimension.name] = value.canonicalType || String(value.id);
    if (value.tokens) {
      carriers.push({
        name: dimension.name,
        precedence: dimension.precedence || 0,
        index,
        tokens: value.tokens,
      });
    }
  });

  values.locale = localeOf(active, selections);

  return { values, sources: resolveTokens(carriers, values, dimensions) };
}

/**
 * The locale of the values chosen, `fr-BE`, from the codes of the dimensions
 * holding a role; an empty string when unknown, so a template's `lang` is
 * emptied rather than left on another email's.
 */
function localeOf(dimensions, selections) {
  const codes = dimensions.reduce((byRole, dimension) => {
    if (!dimension.role) return byRole;
    const chosen = selections && selections[dimension.name];
    const value = (dimension.values || []).find(
      (option) => String(option.id) === String(chosen)
    );
    byRole[dimension.role] = (value && value.code) || null;
    return byRole;
  }, {});
  return composeLocale(codes).locale || '';
}

/**
 * Write the tokens of the chosen values into `values`, the lowest precedence
 * first so the highest is written last and wins.
 *
 * @returns {Object} token name → `{dimension, overrode}`
 */
function resolveTokens(carriers, values, dimensions) {
  // A token never shadows a dimension: `_root_.audience` stays the audience.
  const reserved = new Set([
    'trigger',
    'locale',
    ...(dimensions || []).map((dimension) => dimension.name),
  ]);
  const sources = {};

  carriers
    .sort((a, b) => a.precedence - b.precedence || a.index - b.index)
    .forEach((carrier) => {
      Object.entries(carrier.tokens).forEach(([name, token]) => {
        if (reserved.has(name)) return;
        const previous = sources[name];
        values[name] = token;
        sources[name] = {
          dimension: carrier.name,
          overrode: previous ? [...previous.overrode, previous.dimension] : [],
        };
      });
    });

  return sources;
}

module.exports = { governanceValues };
