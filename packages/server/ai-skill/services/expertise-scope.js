'use strict';

/**
 * Normalisation of expertise scopes — the ONE place that decides what "the same
 * scope" means.
 *
 * A scope is free text: an admin types it in the UI when tagging an expertise,
 * and a developer writes the same string in code when calling findApplicable.
 * Nothing links the two sides, and the match is a strict string equality, so
 * `CTA` typed in the UI never meets `cta` written in code — the expertise is
 * simply not loaded, silently (cf. review R2).
 *
 * Normalising both the write and the read side removes the whole class of
 * case/whitespace mismatches. It cannot do anything about genuine synonyms
 * (`cta` vs `bouton`) — that is what the warning in findApplicable is for.
 *
 * Both the expertise service (write), the repository (read) and
 * scripts/migrate-expertise-scope-normalize.js (existing data) go through here,
 * so the three can never drift apart.
 */

/**
 * @param {*} value
 * @returns {string} the canonical form, or '' for anything that is not usable
 */
function normalizeScope(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

/**
 * Canonical form of a scope list: normalised, emptied of blanks, deduped, and
 * ordered so two equivalent lists are stored identically.
 *
 * @param {*} values
 * @returns {string[]}
 */
function normalizeScopes(values) {
  const list = Array.isArray(values) ? values : [values];
  const normalized = list.map(normalizeScope).filter(Boolean);
  return [...new Set(normalized)].sort();
}

module.exports = { normalizeScope, normalizeScopes };
