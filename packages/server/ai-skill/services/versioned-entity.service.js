'use strict';

/**
 * The versioned-entity lifecycle, once.
 *
 * Skills and expertises are two documents with the same versioning contract:
 * major/minor numbering, DRAFT as the only mutable status, one ACTIVE version at
 * a time pointed at by `activeVersion`, the previous one archived on
 * publication. Both services used to implement that state machine in full —
 * `createMinorVersion` was identical to the character between them — so every
 * versioning fix had to be applied twice, and this PR already had to port two
 * of them (schema copy on version creation, minor-version activation modal).
 *
 * `version-helpers.js` factored the READ primitives (findVersion, maxMinorFor,
 * assertDraft…). This factors the WRITE operations, which carry the actual
 * logic. What genuinely differs per entity is passed in:
 *
 *   - `contentFields`: which fields a new version inherits from its source.
 *     Everything else (numbering, status, changelog defaults, timestamps) is
 *     lifecycle and lives here.
 *   - `activationGate`: extra publication checks. Skills validate their
 *     input/output schemas and template coherence; expertises have none.
 *
 * What stays in each service is what is genuinely its own: listing, document
 * creation and patching, and per-entity extras (expertise facets and activation
 * impact, skill schema defaults).
 */

const createError = require('http-errors');
const {
  SkillStatuses,
  MinorVersionDefaults,
} = require('../constant/skill-constants.js');
const {
  findVersion,
  findActiveVersion,
  maxMajor,
  maxMinorFor,
  assertDraft,
} = require('./version-helpers.js');

/**
 * @param {Object} options
 * @param {import('mongoose').Model} options.model
 * @param {string} options.entityLabel Capitalised, for 404 messages ("Skill")
 * @param {string} options.entityNoun Lowercase, for prose ("skill")
 * @param {string} options.idField Business key field ("skillId")
 * @param {Array<{name: string, default: Function, deep?: boolean}>} options.contentFields
 * @param {(version: Object) => void} [options.activationGate] Throws to refuse publication
 */
function createVersionedEntityService({
  model,
  entityLabel,
  entityNoun,
  idField,
  contentFields,
  activationGate,
}) {
  async function getDoc(id) {
    const doc = await model.findOne({ [idField]: id });
    if (!doc) throw createError(404, `${entityLabel} "${id}" not found`);
    return doc;
  }

  /**
   * A version with every content field at its empty value. Derived from
   * `contentFields`, so adding a field to the model and to that list is enough
   * for the blank seed, all three copy paths and their tests to follow.
   */
  function blankVersionContent() {
    const out = {};
    for (const field of contentFields) out[field.name] = field.default();
    return out;
  }

  /**
   * Copy the content of an existing version. `deep: true` fields are structurally
   * cloned so the new version never shares a reference with its source; a
   * missing or null value falls back to the field's empty value.
   */
  function cloneVersionContent(source) {
    if (!source) return blankVersionContent();
    const out = {};
    for (const field of contentFields) {
      const value = source[field.name];
      if (value === undefined || value === null) {
        out[field.name] = field.default();
      } else if (field.deep) {
        out[field.name] = JSON.parse(JSON.stringify(value));
      } else {
        out[field.name] = value;
      }
    }
    return out;
  }

  // Content fields plus the two release-note fields, which are metadata but are
  // edited in the same form as the content.
  const PATCHABLE_VERSION_FIELDS = [
    ...contentFields.map((f) => f.name),
    'changelog',
    'releaseNotes',
  ];

  /**
   * New minor draft on top of the currently active version. Refuses when there
   * is no active version: a minor release is by definition a correction of
   * something already published.
   */
  async function createMinorVersion(id, userId) {
    const doc = await getDoc(id);
    const active = findActiveVersion(doc);
    if (!active) {
      throw createError(
        400,
        `Cannot create a minor version: no active version on this ${entityNoun}`
      );
    }
    const versionMajor = active.versionMajor;
    const now = new Date();
    doc.versions.push({
      versionMajor,
      versionMinor: maxMinorFor(doc, versionMajor) + 1,
      status: 'DRAFT',
      ...cloneVersionContent(active),
      // A minor release carries no doctrine change, so it is pre-filled and the
      // activation gate does not ask for it (unlike a major). These are stored
      // CONTENT, displayed as authored — see MinorVersionDefaults for why they
      // are French and not an i18n key.
      changelog: MinorVersionDefaults.changelog,
      releaseNotes: MinorVersionDefaults.releaseNotes,
      createdBy: userId,
      createdAt: now,
      updatedBy: userId,
      updatedAt: now,
    });
    await doc.save();
    return doc;
  }

  /**
   * New major draft, seeded from `source` (the "Duplicate" flow) or from the
   * currently active version, falling back to a blank version.
   */
  async function createMajorVersion(id, { source, userId } = {}) {
    const doc = await getDoc(id);
    const seed = source || findActiveVersion(doc);
    const now = new Date();
    doc.versions.push({
      versionMajor: maxMajor(doc) + 1,
      versionMinor: 0,
      status: 'DRAFT',
      ...cloneVersionContent(seed),
      // Left empty on purpose: the activation gate requires the author to write
      // both before a major can be published.
      changelog: '',
      releaseNotes: '',
      createdBy: userId,
      createdAt: now,
      updatedBy: userId,
      updatedAt: now,
    });
    await doc.save();
    return doc;
  }

  async function updateVersion(id, { major, minor }, patch, userId) {
    const doc = await getDoc(id);
    const version = findVersion(doc, major, minor);
    assertDraft(version);
    for (const key of PATCHABLE_VERSION_FIELDS) {
      if (patch[key] !== undefined) version[key] = patch[key];
    }
    version.updatedBy = userId;
    version.updatedAt = new Date();
    await doc.save();
    return doc;
  }

  async function deleteVersion(id, { major, minor }) {
    const doc = await getDoc(id);
    const version = findVersion(doc, major, minor);
    assertDraft(version); // 404 if missing, 409 if not DRAFT
    doc.versions = doc.versions.filter(
      (v) => !(v.versionMajor === major && v.versionMinor === minor)
    );
    await doc.save();
    return doc;
  }

  /**
   * Publish a DRAFT: run the entity's own gate, require release notes on a
   * major, archive the version it replaces, and move the `activeVersion`
   * pointer.
   */
  async function activateVersion(id, { major, minor }, payload = {}, userId) {
    const doc = await getDoc(id);
    const version = findVersion(doc, major, minor);
    if (!version) throw createError(404, `Version ${major}.${minor} not found`);
    if (version.status !== 'DRAFT') {
      throw createError(409, 'Only DRAFT versions can be activated');
    }

    if (activationGate) activationGate(version);

    // Major releases require explicit changelog and releaseNotes. Minor
    // releases inherit the auto-filled defaults from createMinorVersion.
    const isMajor = version.versionMinor === 0;
    if (isMajor && (!payload.changelog || !payload.releaseNotes)) {
      throw createError(
        400,
        'changelog and releaseNotes are required to activate a major version'
      );
    }
    if (payload.changelog) version.changelog = payload.changelog;
    if (payload.releaseNotes) version.releaseNotes = payload.releaseNotes;

    const previousActive = findActiveVersion(doc);
    if (previousActive && previousActive !== version) {
      previousActive.status = 'ARCHIVED';
    }

    const now = new Date();
    version.status = 'ACTIVE';
    version.activatedAt = now;
    version.updatedBy = userId;
    version.updatedAt = now;
    doc.activeVersion = {
      major: version.versionMajor,
      minor: version.versionMinor,
    };
    doc.status = SkillStatuses.ACTIVE;
    await doc.save();
    return doc;
  }

  async function archive(id) {
    const doc = await getDoc(id);
    doc.status = SkillStatuses.ARCHIVED;
    await doc.save();
    return doc;
  }

  return {
    getDoc,
    blankVersionContent,
    cloneVersionContent,
    createMinorVersion,
    createMajorVersion,
    updateVersion,
    deleteVersion,
    activateVersion,
    archive,
    PATCHABLE_VERSION_FIELDS,
  };
}

module.exports = { createVersionedEntityService };
