'use strict';

/**
 * The identifier of a value, the name a template compares (ADR-0015,
 * ADR-0030): proposed from a label, and made free within a dimension. Shared by
 * the taxonomy workspace, which proposes one as the admin types, and the
 * server, which gives one to a default or a migrated email type.
 */

// What a template can compare: letters without accents, digits, `_` and `-`.
const IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]+$/;
// The longest identifier a value stores: `TaxonomyLimits.CANONICAL_TYPE`.
const IDENTIFIER_MAX_LENGTH = 60;

module.exports = {
  IDENTIFIER_PATTERN,
  IDENTIFIER_MAX_LENGTH,
  proposeIdentifier,
  freeIdentifier,
};

/**
 * @param {string} label
 * @returns {string} `Belgique — français` gives `belgique_francais`; empty
 *   when nothing in the label can be kept. Cut to the stored length: a label
 *   may be twice as long as an identifier.
 */
function proposeIdentifier(label) {
  return String(label || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .slice(0, IDENTIFIER_MAX_LENGTH)
    .replace(/^_+|_+$/g, '');
}

/**
 * @param {string} identifier
 * @param {Set<string>} taken the identifiers the dimension already uses
 * @returns {string} `service`, else `service_2`, `service_3`…: the first one
 *   not taken
 */
function freeIdentifier(identifier, taken) {
  if (!taken.has(identifier)) return identifier;
  const suffixed = (suffix) =>
    `${identifier.slice(
      0,
      IDENTIFIER_MAX_LENGTH - String(suffix).length - 1
    )}_${suffix}`;
  let suffix = 2;
  while (taken.has(suffixed(suffix))) suffix += 1;
  return suffixed(suffix);
}
