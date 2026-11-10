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
const { asList, usedSkillIds, declaresUse } = require('./feature-use.js');

const NOT_ARCHIVED = { $ne: SkillStatuses.ARCHIVED };
const isArchived = (doc) => doc.status === SkillStatuses.ARCHIVED;
const SOURCE = 'publication.guard';

// The replay is bounded: so many AI calls at most, a few at a time.
const MAX_REPLAY_CALLS = 60;
const REPLAY_CONCURRENCY = 3;

// Why a replay gave no output, as a code the back office words.
const REPLAY_ERRORS = Object.freeze({
  CONTRACT: 'OUTPUT_CONTRACT',
  INPUT: 'INPUT_INVALID',
  FAILED: 'CALL_FAILED',
});

/**
 * The runs of a replay, without calling anything: for each feature skill, the
 * version the cases run against before (the active one) and after (its draft
 * when it is published too, the active one otherwise), its cases, and the
 * feature skills that have none.
 *
 * @param {{ skillIds: string[], drafts: Map<string, { major, minor }> }}
 *   params `drafts`: the skills published with their new version
 */
async function planRuns({ skillIds, drafts }) {
  const skills = await LePatronSkills.find({
    skillId: { $in: skillIds },
  }).lean();
  // An archived skill is called by no feature: it is replayed only when it
  // is published again, with no before.
  const byId = new Map(
    skills
      .filter((skill) => !isArchived(skill) || drafts.has(skill.skillId))
      .map((skill) => [skill.skillId, skill])
  );

  const runs = [];
  const missing = [];
  skillIds.forEach((skillId) => {
    const skill = byId.get(skillId);
    const active =
      skill && !isArchived(skill) ? findActiveVersion(skill) : null;
    const draft = drafts.get(skillId);
    // A skill's own cases travel with the version being published.
    const after =
      skill && draft ? findVersion(skill, draft.major, draft.minor) : active;
    const cases = after ? asList(after.testCases) : [];
    if (!cases.length) {
      missing.push(skillId);
      return;
    }
    runs.push({ skill, before: active, after, cases });
  });
  return { ...withinCap(runs), missing, maxCalls: MAX_REPLAY_CALLS };
}

// The runs cut to the cases the cap allows, in order, and how many are left
// out: a case costs two calls with a before, one without.
function withinCap(runs) {
  let calls = 0;
  let notReplayed = 0;
  const kept = runs
    .map((run) => {
      const cost = run.before ? 2 : 1;
      const cases = run.cases.filter(() => {
        if (calls + cost > MAX_REPLAY_CALLS) {
          notReplayed += 1;
          return false;
        }
        calls += cost;
        return true;
      });
      return { ...run, cases };
    })
    .filter((run) => run.cases.length);
  return { runs: kept, calls, notReplayed };
}

// Runs `task` on each item, `limit` at a time, the results in the items'
// order.
async function eachLimited(items, limit, task) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      // eslint-disable-next-line no-await-in-loop
      results[index] = await task(items[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  );
  return results;
}

/**
 * What the guard will replay for one version: the feature skills it reaches.
 *
 * @param {{ kind: 'skill'|'expertise', id: string,
 *   version: { major: number, minor: number }, manifests: Object[] }} params
 *   `manifests`: the features that use what is published
 */
function planReplay({ kind, id, version, manifests }) {
  const skillIds =
    kind === 'skill' ? [id] : [...new Set(manifests.flatMap(usedSkillIds))];
  const drafts = new Map(kind === 'skill' ? [[id, version]] : []);
  return planRuns({ skillIds, drafts });
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
 * active versions, and the same with the expertises being published swapped
 * for their new versions.
 */
function expertiseMix(skillId, expertises, overrides) {
  const callers = manifestRegistry
    .listManifests()
    .filter((manifest) => usedSkillIds(manifest).includes(skillId));
  const loaded = expertises
    .filter((doc) =>
      callers.some((manifest) => declaresUse(manifest, 'expertise', doc))
    )
    .sort(byPromptOrder);
  // An archived expertise is loaded by no feature, until it is published.
  const versionOf = (doc, swapped) => {
    const override = swapped && overrides.find((o) => o.id === doc.expertiseId);
    if (override) {
      return findVersion(doc, override.version.major, override.version.minor);
    }
    return isArchived(doc) ? null : findActiveVersion(doc);
  };
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
 * Replay the cases of a plan, a few calls at a time. `overrides`: the
 * expertises published, `{ id, version }`, swapped in after.
 *
 * @returns {Promise<Array<{ skillId, name, notes, input, expectedOutput?,
 *   before: ({ output }|{ error })|null, after: { output }|{ error },
 *   contract: { before: boolean|null, after: boolean|null } }>>}
 */
async function replay({ runs, overrides = [] }) {
  if (!runs.length) return [];
  const groupId = await platformGroupId();
  // With the archived ones published again, which load once published.
  const expertises = [
    ...(await Expertises.find({ status: NOT_ARCHIVED }).lean()),
    ...(overrides.length
      ? await Expertises.find({
          expertiseId: { $in: overrides.map((o) => o.id) },
          status: SkillStatuses.ARCHIVED,
        }).lean()
      : []),
  ];
  const jobs = runs.flatMap((run) => {
    const mix = expertiseMix(run.skill.skillId, expertises, overrides);
    return run.cases.map((testCase) => ({ run, mix, testCase }));
  });
  return eachLimited(jobs, REPLAY_CONCURRENCY, ({ run, mix, testCase }) =>
    replayCase({ run, mix, testCase, groupId })
  );
}

// One case, before then after.
async function replayCase({ run, mix, testCase, groupId }) {
  const { skillId } = run.skill;
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
  return {
    skillId,
    name: testCase.name,
    notes: testCase.notes || '',
    input: testCase.input,
    // What a good output should hold, for the person to compare with.
    ...(testCase.expectedOutput !== undefined && {
      expectedOutput: testCase.expectedOutput,
    }),
    before: before ? before.result : null,
    after: after.result,
    contract: {
      before: before ? before.contract : null,
      after: after.contract,
    },
  };
}

module.exports = {
  planReplay,
  planRuns,
  replay,
  MAX_REPLAY_CALLS,
  REPLAY_ERRORS,
};
