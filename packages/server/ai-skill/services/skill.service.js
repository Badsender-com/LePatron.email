'use strict';

const createError = require('http-errors');
const { LePatronSkills } = require('../../common/models.common.js');
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
  skillId: 1,
  title: 1,
  description: 1,
  category: 1,
  status: 1,
  activeVersion: 1,
  intendedUseCases: 1,
  inputSchemaId: 1,
  outputSchemaId: 1,
  owner: 1,
  createdAt: 1,
  updatedAt: 1,
};

async function listSkills({ category, status, page = 1, pageSize = 50 } = {}) {
  const query = {};
  if (category) query.category = category;
  if (status) query.status = status;
  const limit = Math.min(Math.max(parseInt(pageSize, 10) || 50, 1), 200);
  const skip = Math.max((parseInt(page, 10) || 1) - 1, 0) * limit;
  const [items, total] = await Promise.all([
    LePatronSkills.find(query, LIST_PROJECTION)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    LePatronSkills.countDocuments(query),
  ]);
  return { items, total, page: Math.floor(skip / limit) + 1, pageSize: limit };
}

async function getSkill(skillId) {
  const skill = await LePatronSkills.findOne({ skillId });
  if (!skill) throw createError(404, `Skill "${skillId}" not found`);
  return skill;
}

async function createSkill(data, userId) {
  const payload = {
    skillId: data.skillId,
    title: data.title,
    description: data.description || '',
    category: data.category,
    inputSchemaId: data.inputSchemaId,
    outputSchemaId: data.outputSchemaId,
    intendedUseCases: data.intendedUseCases || [],
    owner: userId,
    status: SkillStatuses.DRAFT,
    activeVersion: { major: null, minor: 0 },
    versions: [],
  };
  try {
    return await LePatronSkills.create(payload);
  } catch (err) {
    if (err && err.code === 11000) {
      throw createError(409, `skillId "${data.skillId}" already exists`);
    }
    throw err;
  }
}

const PATCHABLE_FIELDS = [
  'title',
  'description',
  'category',
  'inputSchemaId',
  'outputSchemaId',
  'intendedUseCases',
];

async function updateSkill(skillId, patch) {
  const skill = await getSkill(skillId);
  for (const key of PATCHABLE_FIELDS) {
    if (patch[key] !== undefined) skill[key] = patch[key];
  }
  await skill.save();
  return skill;
}

// ─── Versioning ────────────────────────────────────────────────────────────

function blankVersionContent() {
  return {
    systemPrompt: '',
    skillBody: '',
    inputTemplate: '',
    modelHints: {},
    testCases: [],
  };
}

function cloneVersionContent(source) {
  if (!source) return blankVersionContent();
  return {
    systemPrompt: source.systemPrompt || '',
    skillBody: source.skillBody || '',
    inputTemplate: source.inputTemplate || '',
    modelHints: source.modelHints
      ? JSON.parse(JSON.stringify(source.modelHints))
      : {},
    testCases: source.testCases
      ? JSON.parse(JSON.stringify(source.testCases))
      : [],
  };
}

/**
 * Create a new minor draft on top of the currently active version.
 * Errors if no active version exists.
 */
async function createMinorVersion(skillId, userId) {
  const skill = await getSkill(skillId);
  const active = findActiveVersion(skill);
  if (!active) {
    throw createError(
      400,
      'Cannot create a minor version: no active version on this skill'
    );
  }
  const versionMajor = active.versionMajor;
  const versionMinor = maxMinorFor(skill, versionMajor) + 1;
  const now = new Date();
  skill.versions.push({
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
  await skill.save();
  return skill;
}

/**
 * Create a new major draft. Optionally seeded from a specific version
 * (used by the "Duplicate" flow). If no source is given, seeds from the
 * currently active version, falling back to an empty version.
 */
async function createMajorVersion(skillId, { source, userId } = {}) {
  const skill = await getSkill(skillId);
  const seed = source || findActiveVersion(skill);
  const versionMajor = maxMajor(skill) + 1;
  const now = new Date();
  skill.versions.push({
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
  await skill.save();
  return skill;
}

async function updateVersion(skillId, { major, minor }, patch, userId) {
  const skill = await getSkill(skillId);
  const version = findVersion(skill, major, minor);
  assertDraft(version);
  for (const key of [
    'systemPrompt',
    'skillBody',
    'inputTemplate',
    'modelHints',
    'testCases',
    'changelog',
    'releaseNotes',
  ]) {
    if (patch[key] !== undefined) version[key] = patch[key];
  }
  version.updatedBy = userId;
  version.updatedAt = new Date();
  await skill.save();
  return skill;
}

async function deleteVersion(skillId, { major, minor }) {
  const skill = await getSkill(skillId);
  const version = findVersion(skill, major, minor);
  assertDraft(version); // 404 if missing, 409 if not DRAFT
  skill.versions = skill.versions.filter(
    (v) => !(v.versionMajor === major && v.versionMinor === minor)
  );
  await skill.save();
  return skill;
}

async function activateVersion(skillId, { major, minor }, payload, userId) {
  const skill = await getSkill(skillId);
  const version = findVersion(skill, major, minor);
  if (!version) throw createError(404, `Version ${major}.${minor} not found`);
  if (version.status !== 'DRAFT') {
    throw createError(409, 'Only DRAFT versions can be activated');
  }
  // Major releases require explicit changelog and releaseNotes. Minor
  // releases inherit the auto-filled defaults from createMinorVersion.
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

  // Archive the previously active version, if any.
  const previousActive = findActiveVersion(skill);
  if (previousActive && previousActive !== version) {
    previousActive.status = 'ARCHIVED';
  }

  version.status = 'ACTIVE';
  version.activatedAt = new Date();
  version.updatedBy = userId;
  version.updatedAt = new Date();
  skill.activeVersion = {
    major: version.versionMajor,
    minor: version.versionMinor,
  };
  skill.status = SkillStatuses.ACTIVE;
  await skill.save();
  return skill;
}

async function archiveSkill(skillId) {
  const skill = await getSkill(skillId);
  skill.status = SkillStatuses.ARCHIVED;
  await skill.save();
  return skill;
}

module.exports = {
  listSkills,
  getSkill,
  createSkill,
  updateSkill,
  createMinorVersion,
  createMajorVersion,
  updateVersion,
  deleteVersion,
  activateVersion,
  archiveSkill,
  versionLabel,
};
