'use strict';

/**
 * Publishing what a feature uses (ADR 0019, epic #1421): the guard that
 * replays the test cases of the feature skills concerned, the publication
 * after it, and the cancellation. Which features use an item is worked out
 * in feature-use.js.
 */

const createError = require('http-errors');
const logger = require('../../utils/logger.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const { asList, describeFeature } = require('./feature-use.js');
const { loadUse } = require('./publication-target.js');
const { planReplay, replay } = require('./publication-guard.js');
const { findVersion } = require('./version-helpers.js');
const skillService = require('./skill.service.js');
const expertiseService = require('./expertise.service.js');

const serviceFor = (kind) =>
  kind === 'skill' ? skillService : expertiseService;

/**
 * What the guard would replay, without calling the AI: the features that use
 * what is published, the number of AI calls, the feature skills without a
 * test case. Read before the person starts the replay.
 */
async function planPublication({ kind, id, version }) {
  const { manifests } = await loadUse({ kind, id, version });
  if (!manifests.length) return { usedBy: [], calls: 0, missing: [] };
  const plan = await planReplay({ kind, id, version, manifests });
  return {
    usedBy: manifests.map(describeFeature),
    calls: plan.calls,
    missing: plan.missing,
  };
}

/**
 * Replay the test cases of the feature skills a version reaches, with the
 * active version and with the new one. Publishes nothing.
 *
 * @returns {Promise<{ usedBy, calls, cases, missing }>}
 */
async function guardPublication({ kind, id, version }) {
  const { manifests } = await loadUse({ kind, id, version });
  if (!manifests.length)
    return { usedBy: [], calls: 0, cases: [], missing: [] };
  const plan = await planReplay({ kind, id, version, manifests });
  const cases = await replay({
    runs: plan.runs,
    overrides: kind === 'expertise' ? [{ id, version }] : [],
  });
  return {
    usedBy: manifests.map(describeFeature),
    calls: plan.calls,
    cases,
    missing: plan.missing,
  };
}

const isGuard = (guard) => !!guard && Array.isArray(guard.cases);

// A case fails when its new output is missing or breaks the contract.
const failedCases = (guard) =>
  guard.cases.filter(
    (c) =>
      !c.after || c.after.error || (c.contract && c.contract.after === false)
  ).length;

async function record(
  { kind, id, version, guard, application },
  user,
  decision
) {
  const service = serviceFor(kind);
  const doc = await (kind === 'skill'
    ? service.getSkill(id)
    : service.getExpertise(id));
  const target = findVersion(doc, version.major, version.minor);
  target.guardHistory = [
    ...asList(target.guardHistory),
    {
      decision,
      by: user ? user.id : null,
      application: application || null,
      at: new Date(),
      cases: guard.cases.length,
      failed: failedCases(guard),
      missing: asList(guard.missing),
    },
  ];
  await doc.save();
  return doc;
}

/**
 * Publish a draft. A version a feature uses is published only once its guard
 * has run, whatever it showed: the guard warns, it never blocks. The decision
 * is recorded with the version.
 *
 * @param {{ kind, id, version: { major, minor }, guard?, payload?,
 *   application? }} params `payload`: changelog and release notes, and for a
 *   skill the opening the publication asks for (`openToAll`,
 *   `openExpertiseIds`, ADR 0013); `application`: the assistant that asked,
 *   if any
 * @param {{ id: string }} user
 * @returns {Promise<{ doc: Object, warnings: Object[] }>} the published
 *   skill or expertise, and the warnings of a skill's opening
 * @throws {HttpError} 409 `SKILL_PUBLICATION_GUARD_REQUIRED`, with what the
 *   guard would replay (`usedBy`, `calls`, `missing`)
 */
async function publishVersion(params, user) {
  const { kind, id, version, guard, payload } = params;
  const { manifests } = await loadUse({ kind, id, version });
  if (manifests.length && !isGuard(guard)) {
    const plan = await planPublication({ kind, id, version });
    throw createError(409, ERROR_CODES.SKILL_PUBLICATION_GUARD_REQUIRED, plan);
  }
  const published = await serviceFor(kind).activateVersion(
    id,
    version,
    payload || {},
    user ? user.id : undefined
  );
  // A skill's publication answers the warnings of its opening too.
  const { skill, warnings = [] } =
    kind === 'skill' ? published : { skill: published };
  if (!isGuard(guard)) return { doc: skill, warnings };
  return { doc: await record(params, user, 'published'), warnings };
}

/**
 * What a skill's publication warns of, past its opening (ADR 0013): the
 * expertises the version published consumes that are not published, or kept
 * to the platform company while the skill is open to every company. Read once
 * published: a failure to read them is logged, and warns of nothing.
 *
 * @param {{ kind, id, version: { major, minor } }} target
 * @param {Object} doc the item as published
 * @returns {Promise<Array<{ code: string, expertiseIds: string[] }>>}
 */
async function consumedWarningsOf({ kind, id, version }, doc) {
  if (kind !== 'skill') return [];
  try {
    return await serviceFor('skill').consumedExpertiseWarnings(
      doc,
      findVersion(doc, version.major, version.minor)
    );
  } catch (error) {
    logger.error(
      `[ai-skill] the warnings of ${id} ${version.major}.${version.minor} could not be read`,
      error
    );
    return [];
  }
}

/** Record that the person cancelled after the guard. Publishes nothing. */
async function cancelPublication(params, user) {
  await loadUse(params);
  if (!isGuard(params.guard)) {
    throw createError(400, ERROR_CODES.SKILL_PUBLICATION_GUARD_INVALID);
  }
  return record(params, user, 'cancelled');
}

module.exports = {
  cancelPublication,
  consumedWarningsOf,
  guardPublication,
  planPublication,
  publishVersion,
};
