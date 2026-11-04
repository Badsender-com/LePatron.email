'use strict';

/**
 * The replay behind the publication guard (ADR 0019, #1430).
 *
 * Publishing a version a feature uses first replays the test cases of the
 * feature skills concerned, through the skill invocation and the platform
 * group's AI engine: once as production runs today (before), once with the
 * version about to be published (after). A failure is reported, never
 * thrown: an AI's output has no automatic pass or fail, the person decides.
 */

const createError = require('http-errors');
const {
  Expertises,
  LePatronSkills,
  Groups,
} = require('../../common/models.common.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const {
  SkillStatuses,
  InvocationStatuses,
} = require('../constant/skill-constants.js');
const manifestRegistry = require('./manifest-registry.js');
const { projectVersion } = require('../repositories/expertise.repository.js');
const skillInvocation = require('./skill-invocation.service.js');
const { findVersion, findActiveVersion } = require('./version-helpers.js');
const { asList, declaresUse } = require('./feature-use.js');

const NOT_ARCHIVED = { $ne: SkillStatuses.ARCHIVED };
const SOURCE = 'publication.guard';

// Why a replay gave no output, as a code the back office words.
const REPLAY_ERRORS = Object.freeze({
  CONTRACT: 'OUTPUT_CONTRACT',
  INPUT: 'INPUT_INVALID',
  FAILED: 'CALL_FAILED',
});

/**
 * What the guard will replay, without calling anything: the feature skills
 * concerned, the version of each the cases run against, the cases, and the
 * feature skills that have none.
 *
 * @param {{ kind: 'skill'|'expertise', id: string,
 *   version: { major: number, minor: number }, manifests: Object[] }} params
 *   `manifests`: the features that use what is published
 */
async function planReplay({ kind, id, version, manifests }) {
  const skillIds =
    kind === 'skill'
      ? [id]
      : [...new Set(manifests.flatMap((m) => asList(m.usedSkills)))];
  const skills = await LePatronSkills.find({
    skillId: { $in: skillIds },
    status: NOT_ARCHIVED,
  }).lean();
  const byId = new Map(skills.map((skill) => [skill.skillId, skill]));

  const runs = [];
  const missing = [];
  skillIds.forEach((skillId) => {
    const skill = byId.get(skillId);
    const active = skill ? findActiveVersion(skill) : null;
    // A skill's own cases travel with the version being published.
    const after =
      skill && kind === 'skill'
        ? findVersion(skill, version.major, version.minor)
        : active;
    const cases = after ? asList(after.testCases) : [];
    if (!cases.length) {
      missing.push(skillId);
      return;
    }
    runs.push({ skill, before: active, after, cases });
  });
  const calls = runs.reduce(
    (total, run) => total + run.cases.length * (run.before ? 2 : 1),
    0
  );
  return { runs, missing, calls };
}

function byPromptOrder(a, b) {
  // The order findApplicable gives: transversal first, then by identifier.
  if (!!a.isTransversal !== !!b.isTransversal) return a.isTransversal ? -1 : 1;
  return a.expertiseId.localeCompare(b.expertiseId);
}

function asInputEntry(projected) {
  return {
    expertiseId: projected.expertiseId,
    title: projected.title,
    body: projected.body,
    examplesGood: projected.examplesGood,
    examplesBad: projected.examplesBad,
  };
}

/**
 * The expertises the features calling a skill load, before and after: the
 * active versions, and the same with the expertise being published swapped
 * for its new version.
 */
function expertiseMix(skillId, expertises, override) {
  const callers = manifestRegistry
    .listManifests()
    .filter((manifest) => asList(manifest.usedSkills).includes(skillId));
  const loaded = expertises
    .filter((doc) =>
      callers.some((manifest) => declaresUse(manifest, 'expertise', doc))
    )
    .sort(byPromptOrder);
  const versionOf = (doc, swapped) =>
    swapped && override && doc.expertiseId === override.id
      ? findVersion(doc, override.version.major, override.version.minor)
      : findActiveVersion(doc);
  const project = (swapped) =>
    loaded
      .map((doc) => projectVersion(doc, versionOf(doc, swapped)))
      .filter(Boolean)
      .map(asInputEntry);
  return { before: project(false), after: project(true) };
}

// The case's own input, with the expertises the feature would inject.
function compose(input, expertise) {
  const { expertise: _recorded, ...rest } = input || {};
  return expertise.length ? { ...rest, expertise } : rest;
}

async function platformGroupId() {
  const platform = await Groups.findOne(
    { isPlatform: true },
    { _id: 1 }
  ).lean();
  if (!platform) throw createError(409, ERROR_CODES.PLATFORM_GROUP_NOT_FOUND);
  return platform._id;
}

async function runOnce({ skillId, version, input, groupId }) {
  try {
    const { output } = await skillInvocation.invoke({
      skillId,
      input,
      groupId,
      invocationSource: SOURCE,
      version: { major: version.versionMajor, minor: version.versionMinor },
      options: { skipLogging: true, unpublished: true },
    });
    return { result: { output }, contract: true };
  } catch (err) {
    if (err && err.invocationStatus === InvocationStatuses.VALIDATION_ERROR) {
      return err.skillError
        ? { result: { error: REPLAY_ERRORS.INPUT }, contract: null }
        : { result: { error: REPLAY_ERRORS.CONTRACT }, contract: false };
    }
    return { result: { error: REPLAY_ERRORS.FAILED }, contract: null };
  }
}

/**
 * Replay the cases of a plan, one call after the other.
 *
 * @returns {Promise<Array<{ skillId, name, notes, input,
 *   before: ({ output }|{ error })|null, after: { output }|{ error },
 *   contract: { before: boolean|null, after: boolean|null } }>>}
 */
async function replay({ kind, id, version, runs }) {
  if (!runs.length) return [];
  const groupId = await platformGroupId();
  const expertises = await Expertises.find({ status: NOT_ARCHIVED }).lean();
  const override = kind === 'expertise' ? { id, version } : null;
  const cases = [];
  for (const run of runs) {
    const { skillId } = run.skill;
    const mix = expertiseMix(skillId, expertises, override);
    for (const testCase of run.cases) {
      const before = run.before
        ? await runOnce({
            skillId,
            version: run.before,
            input: compose(testCase.input, mix.before),
            groupId,
          })
        : null;
      const after = await runOnce({
        skillId,
        version: run.after,
        input: compose(testCase.input, mix.after),
        groupId,
      });
      cases.push({
        skillId,
        name: testCase.name,
        notes: testCase.notes || '',
        input: testCase.input,
        before: before ? before.result : null,
        after: after.result,
        contract: {
          before: before ? before.contract : null,
          after: after.contract,
        },
      });
    }
  }
  return cases;
}

module.exports = { planReplay, replay, REPLAY_ERRORS };
