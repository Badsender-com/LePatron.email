'use strict';

const createError = require('http-errors');
const { Expertises } = require('../../common/models.common.js');
const { SkillStatuses } = require('../constant/skill-constants.js');

const LIST_PROJECTION = {
  expertiseId: 1,
  title: 1,
  description: 1,
  category: 1,
  scope: 1,
  appliesToEmailTypes: 1,
  appliesToLanguages: 1,
  status: 1,
  activeVersion: 1,
  consumedBySkills: 1,
  owner: 1,
  createdAt: 1,
  updatedAt: 1,
};

async function listExpertise({
  category,
  status,
  page = 1,
  pageSize = 50,
} = {}) {
  const query = {};
  if (category) query.category = category;
  if (status) query.status = status;
  const limit = Math.min(Math.max(parseInt(pageSize, 10) || 50, 1), 200);
  const skip = Math.max((parseInt(page, 10) || 1) - 1, 0) * limit;
  const [items, total] = await Promise.all([
    Expertises.find(query, LIST_PROJECTION)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Expertises.countDocuments(query),
  ]);
  return { items, total, page: Math.floor(skip / limit) + 1, pageSize: limit };
}

async function getExpertise(expertiseId) {
  const exp = await Expertises.findOne({ expertiseId });
  if (!exp) throw createError(404, `Expertise "${expertiseId}" not found`);
  return exp;
}

async function createExpertise(data, userId) {
  const payload = {
    expertiseId: data.expertiseId,
    title: data.title,
    description: data.description || '',
    category: data.category,
    scope: data.scope || [],
    appliesToEmailTypes: data.appliesToEmailTypes || [],
    appliesToLanguages: data.appliesToLanguages || [],
    consumedBySkills: data.consumedBySkills || [],
    owner: userId,
    status: SkillStatuses.DRAFT,
    activeVersion: null,
    versions: [],
  };
  try {
    return await Expertises.create(payload);
  } catch (err) {
    if (err && err.code === 11000) {
      throw createError(
        409,
        `expertiseId "${data.expertiseId}" already exists`
      );
    }
    throw err;
  }
}

const PATCHABLE_FIELDS = [
  'title',
  'description',
  'category',
  'scope',
  'appliesToEmailTypes',
  'appliesToLanguages',
  'consumedBySkills',
];

async function updateExpertise(expertiseId, patch) {
  const exp = await getExpertise(expertiseId);
  for (const key of PATCHABLE_FIELDS) {
    if (patch[key] !== undefined) exp[key] = patch[key];
  }
  await exp.save();
  return exp;
}

async function createVersion(expertiseId, data, userId) {
  const exp = await getExpertise(expertiseId);
  const nextVersionNumber =
    (exp.versions || []).reduce(
      (max, v) => (v.versionNumber > max ? v.versionNumber : max),
      0
    ) + 1;
  exp.versions.push({
    versionNumber: nextVersionNumber,
    body: data.body || '',
    examplesGood: data.examplesGood || [],
    examplesBad: data.examplesBad || [],
    createdBy: userId,
    createdAt: new Date(),
    updatedBy: userId,
    updatedAt: new Date(),
  });
  await exp.save();
  return exp;
}

async function updateVersion(expertiseId, versionNumber, patch, userId) {
  const exp = await getExpertise(expertiseId);
  const version = exp.versions.find(
    (v) => v.versionNumber === Number(versionNumber)
  );
  if (!version) throw createError(404, `Version ${versionNumber} not found`);
  // Activated versions remain editable (user feedback v1.1), but a
  // changelog is required on every patch to keep an audit trail.
  if (version.activatedAt && !patch.changelog) {
    throw createError(
      400,
      'A changelog is required when editing an activated version'
    );
  }
  for (const key of [
    'body',
    'examplesGood',
    'examplesBad',
    'changelog',
    'releaseNotes',
  ]) {
    if (patch[key] !== undefined) version[key] = patch[key];
  }
  version.updatedBy = userId;
  version.updatedAt = new Date();
  await exp.save();
  return exp;
}

async function activateVersion(expertiseId, versionNumber, payload, userId) {
  const exp = await getExpertise(expertiseId);
  const version = exp.versions.find(
    (v) => v.versionNumber === Number(versionNumber)
  );
  if (!version) throw createError(404, `Version ${versionNumber} not found`);
  if (!payload.changelog || !payload.releaseNotes) {
    throw createError(
      400,
      'changelog and releaseNotes are required to activate a version'
    );
  }
  version.changelog = payload.changelog;
  version.releaseNotes = payload.releaseNotes;
  version.activatedAt = new Date();
  version.updatedBy = userId;
  version.updatedAt = new Date();
  exp.activeVersion = version.versionNumber;
  exp.status = SkillStatuses.ACTIVE;
  await exp.save();
  return exp;
}

async function archiveExpertise(expertiseId) {
  const exp = await getExpertise(expertiseId);
  exp.status = SkillStatuses.ARCHIVED;
  await exp.save();
  return exp;
}

module.exports = {
  listExpertise,
  getExpertise,
  createExpertise,
  updateExpertise,
  createVersion,
  updateVersion,
  activateVersion,
  archiveExpertise,
};
