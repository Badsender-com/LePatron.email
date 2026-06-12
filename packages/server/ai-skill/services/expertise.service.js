'use strict';

const createError = require('http-errors');
const { Expertises } = require('../../common/models.common.js');
const { SkillStatuses } = require('../constant/skill-constants.js');
const {
  findVersion,
  findActiveVersion,
  maxMajor,
  maxMinorFor,
  assertDraft,
  versionLabel,
} = require('./version-helpers.js');

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
  consumedBySkill,
  page = 1,
  pageSize = 50,
} = {}) {
  const query = {};
  if (category) query.category = category;
  if (status) query.status = status;
  // Reverse lookup for the skill page's "linked expertise" tab: expertise
  // declaring this skillId in its consumedBySkills field.
  if (consumedBySkill) query.consumedBySkills = consumedBySkill;
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
    activeVersion: { major: null, minor: 0 },
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

// ─── Versioning ────────────────────────────────────────────────────────────

function blankVersionContent() {
  return { body: '', examplesGood: [], examplesBad: [] };
}

function cloneVersionContent(source) {
  if (!source) return blankVersionContent();
  return {
    body: source.body || '',
    examplesGood: Array.isArray(source.examplesGood)
      ? [...source.examplesGood]
      : [],
    examplesBad: Array.isArray(source.examplesBad)
      ? [...source.examplesBad]
      : [],
  };
}

async function createMinorVersion(expertiseId, userId) {
  const exp = await getExpertise(expertiseId);
  const active = findActiveVersion(exp);
  if (!active) {
    throw createError(
      400,
      'Cannot create a minor version: no active version on this expertise'
    );
  }
  const versionMajor = active.versionMajor;
  const versionMinor = maxMinorFor(exp, versionMajor) + 1;
  const now = new Date();
  exp.versions.push({
    versionMajor,
    versionMinor,
    status: 'DRAFT',
    ...cloneVersionContent(active),
    changelog: 'Correction mineure',
    releaseNotes: 'Correction mineure sans changement de doctrine.',
    createdBy: userId,
    createdAt: now,
    updatedBy: userId,
    updatedAt: now,
  });
  await exp.save();
  return exp;
}

async function createMajorVersion(expertiseId, { source, userId } = {}) {
  const exp = await getExpertise(expertiseId);
  const seed = source || findActiveVersion(exp);
  const versionMajor = maxMajor(exp) + 1;
  const now = new Date();
  exp.versions.push({
    versionMajor,
    versionMinor: 0,
    status: 'DRAFT',
    ...cloneVersionContent(seed),
    changelog: '',
    releaseNotes: '',
    createdBy: userId,
    createdAt: now,
    updatedBy: userId,
    updatedAt: now,
  });
  await exp.save();
  return exp;
}

async function updateVersion(expertiseId, { major, minor }, patch, userId) {
  const exp = await getExpertise(expertiseId);
  const version = findVersion(exp, major, minor);
  assertDraft(version);
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

async function deleteVersion(expertiseId, { major, minor }) {
  const exp = await getExpertise(expertiseId);
  const version = findVersion(exp, major, minor);
  assertDraft(version);
  exp.versions = exp.versions.filter(
    (v) => !(v.versionMajor === major && v.versionMinor === minor)
  );
  await exp.save();
  return exp;
}

async function activateVersion(expertiseId, { major, minor }, payload, userId) {
  const exp = await getExpertise(expertiseId);
  const version = findVersion(exp, major, minor);
  if (!version) throw createError(404, `Version ${major}.${minor} not found`);
  if (version.status !== 'DRAFT') {
    throw createError(409, 'Only DRAFT versions can be activated');
  }
  const isMajor = version.versionMinor === 0;
  if (isMajor) {
    if (!payload.changelog || !payload.releaseNotes) {
      throw createError(
        400,
        'changelog and releaseNotes are required to activate a major version'
      );
    }
  }
  if (payload.changelog) version.changelog = payload.changelog;
  if (payload.releaseNotes) version.releaseNotes = payload.releaseNotes;

  const previousActive = findActiveVersion(exp);
  if (previousActive && previousActive !== version) {
    previousActive.status = 'ARCHIVED';
  }

  version.status = 'ACTIVE';
  version.activatedAt = new Date();
  version.updatedBy = userId;
  version.updatedAt = new Date();
  exp.activeVersion = {
    major: version.versionMajor,
    minor: version.versionMinor,
  };
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
  createMinorVersion,
  createMajorVersion,
  updateVersion,
  deleteVersion,
  activateVersion,
  archiveExpertise,
  versionLabel,
};
