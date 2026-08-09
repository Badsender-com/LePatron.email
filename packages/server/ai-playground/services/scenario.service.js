'use strict';

const createError = require('http-errors');
const {
  AIPlaygroundScenarios,
  AIPlaygroundRuns,
  LePatronSkills,
  Expertises,
} = require('../../common/models.common.js');
const { VersionRefModes } = require('../constant/playground-constants.js');

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
  const query = {};
  if (skillId) query['skillRef.skillId'] = skillId;
  if (tag) query.tags = tag;
  if (owner) query.owner = owner;
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
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

async function createScenario(data, userId) {
  await assertReferencesExist(data);
  try {
    return await AIPlaygroundScenarios.create({
      ...data,
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

async function updateScenario(scenarioId, patch, userId) {
  const doc = await getScenario(scenarioId);
  await assertReferencesExist({ ...doc.toObject(), ...patch });
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
 * Confirms the referenced skill exists and is ACTIVE, that any pinned version
 * is reachable, and that each explicit expertise reference points to a real
 * expertise (and its pinned version when applicable).
 */
async function assertReferencesExist(data) {
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
  if (skill.status !== 'ACTIVE') {
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

function escapeRegex(s) {
  return String(s).replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

module.exports = {
  listScenarios,
  getScenario,
  createScenario,
  updateScenario,
  deleteScenario,
};
