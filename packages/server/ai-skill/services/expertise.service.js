'use strict';

const createError = require('http-errors');
const { Expertises } = require('../../common/models.common.js');
const { SkillStatuses } = require('../constant/skill-constants.js');
const { versionLabel } = require('./version-helpers.js');
const manifestRegistry = require('./manifest-registry.js');
const { normalizeScopes } = require('./expertise-scope.js');
const {
  createVersionedEntityService,
} = require('./versioned-entity.service.js');

const LIST_PROJECTION = {
  expertiseId: 1,
  title: 1,
  description: 1,
  category: 1,
  scope: 1,
  isTransversal: 1,
  appliesToEmailTypes: 1,
  appliesToLanguages: 1,
  status: 1,
  activeVersion: 1,
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

// Delegated to the shared lifecycle (see `versioned` below) so the lookup and
// its 404 stay identical across both versioned entities.
function getExpertise(expertiseId) {
  return versioned.getDoc(expertiseId);
}

/**
 * Distinct values already present in the collection — feeds the scope /
 * emailType comboboxes in the create & edit forms (anti-typo: a misspelled
 * scope silently breaks findApplicable).
 */
async function getFacets() {
  const [scopes, emailTypes] = await Promise.all([
    Expertises.distinct('scope'),
    Expertises.distinct('appliesToEmailTypes'),
  ]);
  const clean = (arr) => arr.filter((v) => typeof v === 'string' && v).sort();
  return { scopes: clean(scopes), emailTypes: clean(emailTypes) };
}

async function createExpertise(data, userId) {
  const now = new Date();
  const payload = {
    expertiseId: data.expertiseId,
    title: data.title,
    description: data.description || '',
    category: data.category,
    // Normalised so `CTA` typed in the UI matches `cta` written in a
    // findApplicable call — the match is a strict string equality (R2).
    scope: normalizeScopes(data.scope),
    isTransversal: !!data.isTransversal,
    appliesToEmailTypes: data.appliesToEmailTypes || [],
    appliesToLanguages: data.appliesToLanguages || [],
    owner: userId,
    status: SkillStatuses.DRAFT,
    activeVersion: { major: null, minor: 0 },
    // Seed a v1.0 DRAFT (empty content — expertise has no schemas) so the
    // author lands straight in the version editor, parity with skills (§4).
    versions: [
      {
        versionMajor: 1,
        versionMinor: 0,
        status: 'DRAFT',
        ...blankVersionContent(),
        changelog: '',
        releaseNotes: '',
        createdBy: userId,
        createdAt: now,
        updatedBy: userId,
        updatedAt: now,
      },
    ],
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
  'isTransversal',
  'appliesToEmailTypes',
  'appliesToLanguages',
];

async function updateExpertise(expertiseId, patch) {
  const exp = await getExpertise(expertiseId);
  for (const key of PATCHABLE_FIELDS) {
    if (patch[key] === undefined) continue;
    exp[key] = key === 'scope' ? normalizeScopes(patch[key]) : patch[key];
  }
  await exp.save();
  return exp;
}

// ─── Versioning ────────────────────────────────────────────────────────────

// Content fields of a version — what a new version inherits from its source.
// `sections` is deliberately absent: the schema's pre('save') hook re-derives
// it from `body` on every write, so copying it would only risk a stale index.
//
// Same descriptor shape as the skill side, and consumed by the same shared
// lifecycle: adding a content field here makes the blank seed, all three copy
// paths and their tests follow together.
const VERSION_CONTENT_FIELDS = [
  { name: 'body', default: () => '' },
  { name: 'examplesGood', default: () => [], deep: true },
  { name: 'examplesBad', default: () => [], deep: true },
];

// The versioning state machine lives in versioned-entity.service.js, shared
// with skills (review A1). An expertise has no publication gate — that is the
// one real difference between the two entities' lifecycles.
const versioned = createVersionedEntityService({
  model: Expertises,
  entityLabel: 'Expertise',
  entityNoun: 'expertise',
  idField: 'expertiseId',
  contentFields: VERSION_CONTENT_FIELDS,
});

const {
  blankVersionContent,
  createMinorVersion,
  createMajorVersion,
  updateVersion,
  deleteVersion,
  activateVersion,
} = versioned;

const archiveExpertise = versioned.archive;

/**
 * Activation-impact preview: which declared features would load this
 * expertise (informational, non-blocking — the "informed consent" shown in
 * the activation modal). Depends only on document-level fields
 * (scope/category/emailType/isTransversal), which are already persisted, so
 * the draft being activated does not change the answer.
 *
 * @returns {Promise<Array<{featureType, description, matchedFilter}>>}
 */
async function getActivationImpact(expertiseId) {
  const exp = await getExpertise(expertiseId);
  return manifestRegistry.computeActivationImpact({
    category: exp.category,
    scope: exp.scope || [],
    isTransversal: !!exp.isTransversal,
    appliesToEmailTypes: exp.appliesToEmailTypes || [],
  });
}

module.exports = {
  VERSION_CONTENT_FIELDS,
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
  getActivationImpact,
  getFacets,
  versionLabel,
};
