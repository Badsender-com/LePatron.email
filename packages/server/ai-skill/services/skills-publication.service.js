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
const { issueGuardKey, readGuardKey, isoOf } = require('./guard-key.js');
const { findVersion } = require('./version-helpers.js');
const skillService = require('./skill.service.js');
const expertiseService = require('./expertise.service.js');

const serviceFor = (kind) =>
  kind === 'skill' ? skillService : expertiseService;

/**
 * What the guard would replay, without calling the AI: the features that use
 * what is published, the number of AI calls and the most it makes, the cases
 * left out past that cap, the feature skills without a test case. Read
 * before the person starts the replay.
 */
async function planPublication({ kind, id, version }) {
  const { manifests } = await loadUse({ kind, id, version });
  if (!manifests.length) return { usedBy: [], calls: 0, missing: [] };
  const plan = await planReplay({ kind, id, version, manifests });
  return {
    usedBy: manifests.map(describeFeature),
    calls: plan.calls,
    maxCalls: plan.maxCalls,
    notReplayed: plan.notReplayed,
    missing: plan.missing,
  };
}

// Nothing to replay for a version no feature uses.
const NO_REPLAY = { runs: [], calls: 0, missing: [], notReplayed: 0 };

/**
 * Replay the test cases of the feature skills a version reaches, with the
 * active version and with the new one. Publishes nothing. Answers the key
 * its publication, or its cancellation, requires (guard-key.js), for a
 * version no feature uses too: an assistant's publication rides on it.
 *
 * @param {{ kind, id, version: { major, minor } }} target
 * @param {{ id: string }} user who runs it
 * @param {{ terms?: string }} [options] what else the key binds
 *   (guard-key.js)
 * @returns {Promise<{ usedBy, calls, cases, missing, key }>}
 */
async function guardPublication({ kind, id, version }, user, { terms } = {}) {
  const { doc, manifests } = await loadUse({ kind, id, version });
  const plan = manifests.length
    ? await planReplay({ kind, id, version, manifests })
    : NO_REPLAY;
  const cases = await replay({
    runs: plan.runs,
    overrides: kind === 'expertise' ? [{ id, version }] : [],
  });
  const { updatedAt } = findVersion(doc, version.major, version.minor);
  const guard = {
    cases,
    missing: plan.missing,
    notReplayed: plan.notReplayed,
  };
  return {
    usedBy: manifests.map(describeFeature),
    calls: plan.calls,
    maxCalls: plan.maxCalls,
    ...guard,
    key: issueGuardKey(
      { targets: [{ kind, id, version, updatedAt }], guard, terms },
      user
    ),
  };
}

// What the guard showed, as its key carries it, and what the person
// decided, as kept with the version (guard-record.schema.js).
function recordOf(shown, { application }, user, decision) {
  return {
    decision,
    by: user ? user.id : null,
    application: application || null,
    at: new Date(),
    cases: shown.cases,
    failed: shown.failed,
    missing: asList(shown.missing),
    notReplayed: shown.notReplayed || 0,
  };
}

async function recordCancel(params, shown, user) {
  const { kind, id, version } = params;
  const doc = await (kind === 'skill'
    ? skillService.getSkill(id)
    : expertiseService.getExpertise(id));
  const target = findVersion(doc, version.major, version.minor);
  target.guardHistory = [
    ...asList(target.guardHistory),
    recordOf(shown, params, user, 'cancelled'),
  ];
  await doc.save();
  return doc;
}

/**
 * What a publication checks before it writes, at no cost: the version is a
 * draft as the page read it, passes its gate (a schema missing from the code,
 * a skill's template), a major has its release notes, a skill's opening is
 * valid. Read before the guard replays anything (ADR 0019).
 *
 * @param {{ kind, version: { major, minor } }} target
 * @param {Object} doc the stored skill or expertise
 * @param {Object} [payload] what the publication is asked with
 * @throws {HttpError} what the publication itself would answer
 */
function checkPublication({ kind, version }, doc, payload = {}) {
  return serviceFor(kind).checkPublishable(doc, version, payload || {});
}

/**
 * The guard a publication rides on: the key its guard answered, on the
 * version as it was then, required for a version a feature uses. A key
 * given for one no feature uses is checked and recorded all the same.
 *
 * @returns {Promise<{ updatedAt, guard }|null>} what the key carries
 * @throws {HttpError} 409 `SKILL_PUBLICATION_GUARD_REQUIRED`, with what the
 *   guard would replay; 400 `SKILL_PUBLICATION_GUARD_INVALID`; 409
 *   `SKILL_VERSION_CHANGED` when the version was written since its guard
 */
async function guardOf(params, user, { doc, manifests }) {
  const { kind, id, version, guardKey, payload } = params;
  if (!guardKey && !manifests.length) return null;
  if (!guardKey) {
    // A publication refused anyway is refused before the guard costs a call.
    await checkPublication(params, doc, payload);
    const plan = await planPublication({ kind, id, version });
    throw createError(409, ERROR_CODES.SKILL_PUBLICATION_GUARD_REQUIRED, plan);
  }
  const ran = readGuardKey(guardKey, params, user);
  const stored = findVersion(doc, version.major, version.minor);
  if (ran.updatedAt !== isoOf(stored.updatedAt)) {
    throw createError(409, ERROR_CODES.SKILL_VERSION_CHANGED);
  }
  return ran;
}

/**
 * Publish a draft. A version a feature uses is published only with the key
 * its guard answered, whatever the guard showed: it warns, it never blocks.
 * The decision is recorded with the version, from what the key carries.
 *
 * @param {{ kind, id, version: { major, minor }, guardKey?, payload?,
 *   application? }} params `payload`: changelog and release notes, and for a
 *   skill the opening the publication asks for (`openToAll`,
 *   `openExpertiseIds`, ADR 0013); `application`: the assistant that asked,
 *   if any
 * @param {{ id: string }} user
 * @returns {Promise<{ doc: Object, warnings: Object[] }>} the published
 *   skill or expertise, and the warnings of a skill's opening
 * @throws {HttpError} what guardOf throws
 */
async function publishVersion(params, user) {
  const { kind, id, version, payload = {} } = params;
  const ran = await guardOf(params, user, await loadUse({ kind, id, version }));
  // The decision is written with the publication, in the same write, on the
  // version as its guard read it.
  const published = await serviceFor(kind).activateVersion(
    id,
    version,
    {
      ...payload,
      ...(ran && {
        updatedAt: payload.updatedAt || ran.updatedAt,
        guardRecord: recordOf(ran.guard, params, user, 'published'),
      }),
    },
    user ? user.id : undefined
  );
  // A skill's publication answers the warnings of its opening too.
  const { skill, warnings = [] } =
    kind === 'skill' ? published : { skill: published };
  return { doc: skill, warnings };
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
  const ran = readGuardKey(params.guardKey, params, user);
  return recordCancel(params, ran.guard, user);
}

module.exports = {
  cancelPublication,
  checkPublication,
  consumedWarningsOf,
  guardPublication,
  planPublication,
  publishVersion,
};
