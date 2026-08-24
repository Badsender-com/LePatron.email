'use strict';

const createError = require('http-errors');
const {
  AIPlaygroundScenarios,
  AIPlaygroundRuns,
  LePatronSkills,
  Expertises,
} = require('../../common/models.common.js');
const { VersionRefModes } = require('../constant/playground-constants.js');
const { SkillStatuses } = require('../../ai-skill/constant/skill-constants.js');
const {
  scalarParam,
  objectIdParam,
  escapeRegex,
} = require('../../utils/query-scalars.js');

const LIST_PROJECTION = {
  scenarioId: 1,
  name: 1,
  description: 1,
  tags: 1,
  'skillRef.skillId': 1,
  'skillRef.mode': 1,
  'skillRef.versionMajor': 1,
  'skillRef.versionMinor': 1,
  goldenRunId: 1,
  owner: 1,
  createdAt: 1,
  updatedAt: 1,
};

async function listScenarios({
  skillId,
  tag,
  owner,
  search,
  page = 1,
  pageSize = 50,
} = {}) {
  // Express turns `?skillId[$regex]=.*` into an object: every filter goes
  // through a scalar guard before it becomes a query operand. `search` was
  // already escaped, which is what made the inconsistency visible.
  const query = {};
  const skillIdFilter = scalarParam(skillId, 'skillId');
  const tagFilter = scalarParam(tag, 'tag');
  const ownerFilter = objectIdParam(owner, 'owner');
  const searchFilter = scalarParam(search, 'search');
  if (skillIdFilter) query['skillRef.skillId'] = skillIdFilter;
  if (tagFilter) query.tags = tagFilter;
  if (ownerFilter) query.owner = ownerFilter;
  if (searchFilter) {
    const rx = new RegExp(escapeRegex(searchFilter), 'i');
    query.$or = [{ name: rx }, { description: rx }, { scenarioId: rx }];
  }
  const limit = Math.min(Math.max(parseInt(pageSize, 10) || 50, 1), 200);
  const skip = Math.max((parseInt(page, 10) || 1) - 1, 0) * limit;
  const [items, total] = await Promise.all([
    AIPlaygroundScenarios.find(query, LIST_PROJECTION)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AIPlaygroundScenarios.countDocuments(query),
  ]);
  await decorateWithLastRun(items);
  return { items, total, page: Math.floor(skip / limit) + 1, pageSize: limit };
}

/**
 * Attach { lastRunAt, lastRunStatus, runCount } to each scenario in place.
 * One aggregation for the whole page — cheap at super-admin scale.
 */
async function decorateWithLastRun(items) {
  if (!items.length) return;
  const ids = items.map((s) => s._id);
  const stats = await AIPlaygroundRuns.aggregate([
    { $match: { _scenario: { $in: ids } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$_scenario',
        lastRunAt: { $first: '$createdAt' },
        lastRunStatus: { $first: '$status' },
        runCount: { $sum: 1 },
      },
    },
  ]);
  const byId = new Map(stats.map((s) => [String(s._id), s]));
  for (const item of items) {
    const s = byId.get(String(item._id));
    item.lastRunAt = s ? s.lastRunAt : null;
    item.lastRunStatus = s ? s.lastRunStatus : null;
    item.runCount = s ? s.runCount : 0;
  }
}

async function getScenario(scenarioId) {
  const doc = await AIPlaygroundScenarios.findOne({ scenarioId });
  if (!doc) throw createError(404, `Scenario "${scenarioId}" not found`);
  return doc;
}

/**
 * Distinct values that populate the scenario list filters (skills that have at
 * least one scenario, and tags in use), so the Skill/Tag filters are pick-lists
 * of real values instead of exact-match free text.
 */
async function getScenarioFacets() {
  const [skillIds, tags] = await Promise.all([
    AIPlaygroundScenarios.distinct('skillRef.skillId'),
    AIPlaygroundScenarios.distinct('tags'),
  ]);
  const clean = (arr) =>
    (arr || []).filter((v) => typeof v === 'string' && v).sort();
  return { skillIds: clean(skillIds), tags: clean(tags) };
}

async function createScenario(data, userId) {
  await assertReferencesExist(data);
  try {
    return await AIPlaygroundScenarios.create({
      // Whitelisted like the update path. `create({ ...data })` let a caller
      // set `_id` and `goldenRunId` — the identity of the document and a
      // reference the golden flow owns.
      ...pick(data, CREATABLE_FIELDS),
      owner: userId,
      updatedBy: userId,
    });
  } catch (err) {
    if (err && err.code === 11000) {
      throw createError(409, `scenarioId "${data.scenarioId}" already exists`);
    }
    throw err;
  }
}

function pick(source, fields) {
  const out = {};
  for (const key of fields) {
    if (source && source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

const PATCHABLE_FIELDS = [
  'name',
  'description',
  'tags',
  'skillRef',
  'expertiseRefs',
  'expertiseFilter',
  'input',
  'providerOverride',
  'groupContext',
  'variantPath',
];

// scenarioId is set at creation and immutable afterwards, hence the two lists.
const CREATABLE_FIELDS = ['scenarioId', ...PATCHABLE_FIELDS];

async function updateScenario(scenarioId, patch, userId) {
  const doc = await getScenario(scenarioId);
  // The ACTIVE requirement only applies to a skill reference the caller is
  // actually setting. Re-asserting it on the merged document made a scenario
  // unmodifiable — even renaming it — the moment its skill was archived, and
  // the picker cannot offer a replacement for a non-ACTIVE skill either, so
  // the reference was uncorrectable and only deletion worked. The runner
  // refuses to execute it (loadActiveOrPinnedSkill): fail late at edit,
  // early at run.
  await assertReferencesExist(
    { ...doc.toObject(), ...patch },
    { requireActiveSkill: patch.skillRef !== undefined }
  );
  for (const key of PATCHABLE_FIELDS) {
    if (patch[key] !== undefined) doc[key] = patch[key];
  }
  doc.updatedBy = userId;
  await doc.save();
  return doc;
}

async function deleteScenario(scenarioId) {
  const doc = await getScenario(scenarioId);
  await AIPlaygroundRuns.deleteMany({ _scenario: doc._id });
  await AIPlaygroundScenarios.deleteOne({ _id: doc._id });
  return { deleted: true };
}

/**
 * Confirms the referenced skill exists, that any pinned version is reachable,
 * and that each explicit expertise reference points to a real expertise (and
 * its pinned version when applicable).
 *
 * `requireActiveSkill` (default true) also demands the skill be ACTIVE. An
 * update that does not touch `skillRef` passes false: see updateScenario.
 */
async function assertReferencesExist(data, { requireActiveSkill = true } = {}) {
  if (!data || !data.skillRef || !data.skillRef.skillId) return;
  const skill = await LePatronSkills.findOne(
    { skillId: data.skillRef.skillId },
    { skillId: 1, status: 1, activeVersion: 1, versions: 1 }
  ).lean();
  if (!skill) {
    throw createError(
      400,
      `Skill "${data.skillRef.skillId}" referenced by the scenario does not exist`
    );
  }
  if (requireActiveSkill && skill.status !== SkillStatuses.ACTIVE) {
    throw createError(
      400,
      `Skill "${data.skillRef.skillId}" is not ACTIVE (status=${skill.status})`
    );
  }
  if (data.skillRef.mode === VersionRefModes.PINNED) {
    const found = (skill.versions || []).some(
      (v) =>
        v.versionMajor === data.skillRef.versionMajor &&
        v.versionMinor === (data.skillRef.versionMinor || 0)
    );
    if (!found) {
      throw createError(
        400,
        `Version ${data.skillRef.versionMajor}.${
          data.skillRef.versionMinor || 0
        } of skill "${data.skillRef.skillId}" does not exist`
      );
    }
  }

  for (const ref of data.expertiseRefs || []) {
    const exp = await Expertises.findOne(
      { expertiseId: ref.expertiseId },
      { expertiseId: 1, versions: 1 }
    ).lean();
    if (!exp) {
      throw createError(
        400,
        `Expertise "${ref.expertiseId}" referenced by the scenario does not exist`
      );
    }
    if (ref.mode === VersionRefModes.PINNED) {
      const found = (exp.versions || []).some(
        (v) =>
          v.versionMajor === ref.versionMajor &&
          v.versionMinor === (ref.versionMinor || 0)
      );
      if (!found) {
        throw createError(
          400,
          `Version ${ref.versionMajor}.${ref.versionMinor || 0} of expertise "${
            ref.expertiseId
          }" does not exist`
        );
      }
    }
  }
}

module.exports = {
  listScenarios,
  getScenario,
  getScenarioFacets,
  createScenario,
  updateScenario,
  deleteScenario,
};
