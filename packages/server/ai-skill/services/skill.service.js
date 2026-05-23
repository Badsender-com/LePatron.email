'use strict';

const createError = require('http-errors');
const { LePatronSkills } = require('../../common/models.common.js');
const { SkillStatuses } = require('../constant/skill-constants.js');

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
    activeVersion: null,
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

async function createVersion(skillId, data, userId) {
  const skill = await getSkill(skillId);
  const nextVersionNumber =
    (skill.versions || []).reduce(
      (max, v) => (v.versionNumber > max ? v.versionNumber : max),
      0
    ) + 1;
  skill.versions.push({
    versionNumber: nextVersionNumber,
    systemPrompt: data.systemPrompt || '',
    skillBody: data.skillBody || '',
    inputTemplate: data.inputTemplate || '',
    modelHints: data.modelHints || {},
    testCases: data.testCases || [],
    createdBy: userId,
    createdAt: new Date(),
    updatedBy: userId,
    updatedAt: new Date(),
  });
  await skill.save();
  return skill;
}

async function updateVersion(skillId, versionNumber, patch, userId) {
  const skill = await getSkill(skillId);
  const version = skill.versions.find(
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

async function activateVersion(skillId, versionNumber, payload, userId) {
  const skill = await getSkill(skillId);
  const version = skill.versions.find(
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
  skill.activeVersion = version.versionNumber;
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
  createVersion,
  updateVersion,
  activateVersion,
  archiveSkill,
};
