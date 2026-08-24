'use strict';

/**
 * `repositories/` is NOT a general persistence layer for this module — it holds
 * the complex matching queries only. Everything else (skill, invocation) talks
 * to its model straight from its service, on purpose. Do not add a
 * `skill.repository.js` "for symmetry": that would create an empty layer.
 */

const createError = require('http-errors');
const logger = require('../../utils/logger.js');
const { Expertises } = require('../../common/models.common.js');
const { SkillStatuses } = require('../constant/skill-constants.js');
const { normalizeScopes } = require('../services/expertise-scope.js');
const { findActiveVersion } = require('../services/version-helpers.js');

/**
 * Find ACTIVE expertise modules matching an invocation context, projecting
 * only the active version of each. Used by features composing skill inputs.
 *
 * ALL callers must pass both `scope` AND `categories` — a caller that wants a
 * broad mix enumerates explicitly. The verbosity is deliberate: the expertise
 * mix of a feature is a decision that must be visible in code review.
 *
 * Matching rules — an expertise matches when:
 *   - status ACTIVE
 *   - AND ( isTransversal === true  OR  intersection(expertise.scope, scope) ≠ ∅ )
 *   - AND expertise.category ∈ categories
 *   - AND ( appliesToEmailTypes empty  OR  emailType ∈ appliesToEmailTypes )
 *   - AND ( appliesToLanguages empty   OR  language ∈ appliesToLanguages )
 *
 * NB: an expertise with an empty scope that is NOT transversal NEVER matches
 * (inverted semantics). isTransversal short-circuits ONLY the scope clause —
 * never categories / emailType / language.
 *
 * @param {Object} filters
 * @param {string|string[]} filters.scope — REQUIRED
 * @param {string[]} filters.categories — REQUIRED, non-empty
 * @param {string} [filters.emailType]
 * @param {string} [filters.language]
 * @returns {Promise<Array<{expertiseId: string, title: string, body: string, examplesGood: string[], examplesBad: string[], versionMajor: number, versionMinor: number}>>}
 */
async function findApplicable({ scope, categories, emailType, language } = {}) {
  // Normalised on the way in, as the write side is (services/expertise-scope):
  // the match below is a strict string equality, so `cta` must meet `CTA`.
  const scopes = normalizeScopes(scope);
  if (!scopes.length || !Array.isArray(categories) || !categories.length) {
    // A contract violation by the calling code, not a user error: no error code
    // and no translation, it is read by whoever wrote the call.
    throw createError(
      400,
      'findApplicable requires a scope and at least one category — spell out the expertise mix of your feature'
    );
  }

  // Empty arrays on emailType/language documents still mean "applies to all".
  // For scope the semantics are INVERTED: empty scope no longer matches —
  // only a non-empty intersection or the isTransversal flag does.
  const and = [
    { status: SkillStatuses.ACTIVE },
    { $or: [{ isTransversal: true }, { scope: { $in: scopes } }] },
    { category: { $in: categories } },
  ];

  if (emailType) {
    and.push({
      $or: [
        { appliesToEmailTypes: emailType },
        { appliesToEmailTypes: { $size: 0 } },
      ],
    });
  }
  if (language) {
    and.push({
      $or: [
        { appliesToLanguages: language },
        { appliesToLanguages: { $size: 0 } },
      ],
    });
  }

  const docs = await Expertises.find({ $and: and }).lean();

  // Not awaited: the diagnostic does nothing for this invocation's result, and
  // it issues a `distinct` — on a feature whose scope matches no scoped
  // expertise that would be one extra round-trip on EVERY call, in the hottest
  // path of the module. Errors inside are swallowed by the function itself.
  warnOnUnmatchedScopes(scopes, docs).catch(() => {
    // Belt and braces: the diagnostic must never surface as an invocation
    // failure, and nothing awaits it to notice.
  });

  // Deterministic order = the order expertises appear in the composed prompt:
  // transversal (general) first, then alphabetical by expertiseId. Stable so
  // features and the playground filter mode get a predictable, reviewable mix.
  return docs
    .map((doc) => projectActiveVersion(doc))
    .filter((d) => d !== null)
    .sort((a, b) => {
      if (a.isTransversal !== b.isTransversal) return a.isTransversal ? -1 : 1;
      return a.expertiseId.localeCompare(b.expertiseId);
    });
}

/**
 * Say something when a requested scope matched nothing.
 *
 * This is the silent failure of R2: the caller hardcodes a scope, the admin
 * typed a different word, the intersection is empty — and the invocation
 * proceeds without the doctrine it asked for. Worse, transversal expertises
 * match regardless of scope, so the returned list is rarely empty: the prompt
 * is not broken, just poorer, which is exactly what nobody notices.
 *
 * Normalisation cannot catch this (`cta` vs `bouton` are genuinely different
 * words), so the point is to make it visible, with the scopes that DO exist in
 * the message — that is the one piece of information needed to fix the call.
 *
 * Deliberately a warning and not a throw: a missing expertise degrades the
 * output, it does not make the invocation wrong, and a feature must not break
 * because a doctrine module has not been written yet.
 */
async function warnOnUnmatchedScopes(scopes, docs) {
  const matched = new Set();
  for (const doc of docs) {
    // Transversal expertises are returned whatever the scope, and the schema
    // tolerates them carrying one anyway. Counting their scope as "matched"
    // would suppress the warning precisely when no SCOPED expertise answered —
    // the silence this warning exists to break.
    if (doc.isTransversal) continue;
    for (const value of doc.scope || []) matched.add(value);
  }
  const unmatched = scopes.filter((s) => !matched.has(s));
  if (!unmatched.length) return;

  try {
    const known = await Expertises.distinct('scope', {
      status: SkillStatuses.ACTIVE,
    });
    logger.warn(
      `[expertise] scope(s) ${JSON.stringify(unmatched)} matched no ACTIVE ` +
        'expertise — nothing from that scope will reach the prompt. ' +
        `Scopes in use: ${JSON.stringify(
          normalizeScopes(known)
        )}. Check the findApplicable call against the expertise tagging.`
    );
  } catch (err) {
    // Never let the diagnostic break the invocation it is diagnosing.
    logger.warn(
      `[expertise] scope(s) ${JSON.stringify(
        unmatched
      )} matched no ACTIVE expertise`
    );
  }
}

/**
 * The shape an expertise takes once flattened onto one of its versions — what
 * every consumer (features, playground runner, filter preview) receives.
 * Parameterised by the version so a pinned reference projects through the same
 * code as an active one; only the CHOICE of version differs, and that is the
 * caller's policy.
 */
function projectVersion(doc, version) {
  if (!version) return null;
  return {
    expertiseId: doc.expertiseId,
    title: doc.title,
    category: doc.category,
    scope: doc.scope,
    isTransversal: !!doc.isTransversal,
    versionMajor: version.versionMajor,
    versionMinor: version.versionMinor,
    body: version.body,
    examplesGood: version.examplesGood || [],
    examplesBad: version.examplesBad || [],
    sections: version.sections || [],
  };
}

// Kept as the ACTIVE-version shorthand: `findApplicable` and every feature
// path want the active version, and the version-picking policy stays out of
// the projection.
function projectActiveVersion(doc) {
  return projectVersion(doc, findActiveVersion(doc));
}

module.exports = { findApplicable, projectActiveVersion, projectVersion };
