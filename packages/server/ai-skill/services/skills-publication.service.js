'use strict';

/**
 * Publishing what a feature uses (ADR 0019, epic #1421).
 *
 * "Used by a feature" is worked out, never stored: a feature's skill manifest
 * names the skills it calls (`usedSkills`), the expertises it loads by name
 * (`usedExpertise`) and the filters it loads expertises through
 * (`expertiseFilters`). The manifests are in memory, so the answer costs no
 * more than a loop, and it follows a change of the declarations at once.
 */

const createError = require('http-errors');
const logger = require('../../utils/logger.js');
const { Expertises, LePatronSkills } = require('../../common/models.common.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const { SkillStatuses } = require('../constant/skill-constants.js');
const manifestRegistry = require('./manifest-registry.js');
const { asList, manifestsUsing, describeFeature } = require('./feature-use.js');
const { planReplay, replay } = require('./publication-guard.js');
const { findVersion } = require('./version-helpers.js');

// What an expertise filter is matched against.
const MATCHED_ATTRIBUTES = {
  expertiseId: 1,
  status: 1,
  category: 1,
  scope: 1,
  isTransversal: 1,
  appliesToEmailTypes: 1,
};
const NOT_ARCHIVED = { $ne: SkillStatuses.ARCHIVED };

/**
 * The features that use a skill or an expertise, from their declarations.
 *
 * @param {'skill'|'expertise'} kind
 * @param {Object} entity a skill (`skillId`) or an expertise (`expertiseId`,
 *   and its `category`, `scope`, `isTransversal`, `appliesToEmailTypes`)
 * @returns {Array<{ featureType: string, description: string }>}
 */
function featuresUsing(kind, entity) {
  return manifestsUsing(kind, entity).map(describeFeature);
}

/**
 * The features that use a skill or an expertise, by its identifier. An
 * expertise is read for the attributes its filters are matched against; one
 * that is not stored can still be named by a feature.
 */
async function usedByFeatures({ kind, id }) {
  if (kind !== 'expertise') {
    const skill = await LePatronSkills.findOne(
      { skillId: id },
      { skillId: 1, status: 1 }
    ).lean();
    return featuresUsing(kind, skill || { skillId: id });
  }
  const expertise = await Expertises.findOne(
    { expertiseId: id },
    MATCHED_ATTRIBUTES
  ).lean();
  return featuresUsing(kind, expertise || { expertiseId: id });
}

/**
 * The identifiers of every stored skill or expertise a feature uses, for the
 * lists of the back office to filter on before they page.
 *
 * @param {'skill'|'expertise'} kind
 * @returns {Promise<string[]>}
 */
async function idsUsedByFeatures(kind) {
  if (kind === 'skill') {
    const named = [
      ...new Set(
        manifestRegistry
          .listManifests()
          .flatMap((manifest) => asList(manifest.usedSkills))
      ),
    ];
    const skills = await LePatronSkills.find(
      { skillId: { $in: named }, status: NOT_ARCHIVED },
      { skillId: 1 }
    ).lean();
    return skills.map((skill) => skill.skillId);
  }
  const expertises = await Expertises.find(
    { status: NOT_ARCHIVED },
    MATCHED_ATTRIBUTES
  ).lean();
  return expertises
    .filter((expertise) => featuresUsing('expertise', expertise).length)
    .map((expertise) => expertise.expertiseId);
}

/**
 * A skill or an expertise as the back office reads it, with the features that
 * use it (`usedBy`). Takes a stored document or a plain record.
 */
function withUsedBy(kind, entity) {
  const record =
    entity && typeof entity.toJSON === 'function' ? entity.toJSON() : entity;
  return { ...record, usedBy: featuresUsing(kind, record) };
}

// ── The guard on a publication (#1430) ─────────────────────────────────

const ID_FIELDS = { skill: 'skillId', expertise: 'expertiseId' };
const MODELS = { skill: LePatronSkills, expertise: Expertises };

// Required where used: the skill and expertise services read this module
// for their list filter, and a top-level require would be circular.
function serviceFor(kind) {
  return kind === 'skill'
    ? require('./skill.service.js')
    : require('./expertise.service.js');
}

// The stored skill or expertise and the features that use it; the version
// asked for must exist.
async function loadUse({ kind, id, version }) {
  if (!ID_FIELDS[kind]) throw createError(400, `Unknown kind "${kind}"`);
  const doc = await MODELS[kind].findOne({ [ID_FIELDS[kind]]: id }).lean();
  if (!doc) throw createError(404, `${kind} "${id}" not found`);
  if (!findVersion(doc, version.major, version.minor)) {
    throw createError(
      404,
      `Version ${version.major}.${version.minor} not found`
    );
  }
  return { doc, manifests: manifestsUsing(kind, doc) };
}

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

// A guard that ran: its full answer, or the counts an assistant's
// confirmation carries (ADR 0019).
const isGuard = (guard) =>
  !!guard && (Array.isArray(guard.cases) || !!guard.summary);

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
      ...(guard.summary
        ? {
            cases: guard.summary.cases,
            failed: guard.summary.failed,
            missing: asList(guard.summary.missing),
          }
        : {
            cases: guard.cases.length,
            failed: failedCases(guard),
            missing: asList(guard.missing),
          }),
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
    throw createError(400, 'The guard that was cancelled is required');
  }
  return record(params, user, 'cancelled');
}

module.exports = {
  loadUse,
  cancelPublication,
  consumedWarningsOf,
  guardPublication,
  planPublication,
  publishVersion,
  featuresUsing,
  idsUsedByFeatures,
  usedByFeatures,
  withUsedBy,
};

// Several drafts at once (#1431): read lazily by its own module, which needs
// `loadUse` and `publishVersion` from this one.
const batch = require('./publication-batch.js');

Object.assign(module.exports, {
  cancelMany: batch.cancelMany,
  draftsToPublish: batch.draftsToPublish,
  guardMany: batch.guardMany,
  planMany: batch.planMany,
  publishMany: batch.publishMany,
});
