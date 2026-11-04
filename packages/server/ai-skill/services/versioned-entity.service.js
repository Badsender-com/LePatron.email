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
  Audiences,
} = require('../constant/skill-constants.js');
const {
  findVersion,
  findActiveVersion,
  maxMajor,
  maxMinorFor,
  assertDraft,
  laterThan,
  openDraftOf,
  versionLabel,
} = require('./version-helpers.js');
const {
  createDraftWriter,
  readAtOf,
  saveIfUnchanged,
} = require('./versioned-draft.js');

/**
 * @param {Object} options
 * @param {import('mongoose').Model} options.model
 * @param {string} options.entityLabel Capitalised, for 404 messages ("Skill")
 * @param {string} options.entityNoun Lowercase, for prose ("skill")
 * @param {string} options.idField Business key field ("skillId")
 * @param {Array<{name: string, default: Function, deep?: boolean}>} options.contentFields
 * @param {(version: Object, doc: Object) => (void|Promise<void>)} [options.activationGate]
 *   Throws (or rejects) to refuse publication; receives the version and the
 *   document it belongs to
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

  // A minor draft on top of the active version: a minor release carries no
  // doctrine change, so it is pre-filled and the activation gate does not ask
  // for it (unlike a major). These are stored CONTENT, displayed as authored —
  // see MinorVersionDefaults for why they are French and not an i18n key.
  function minorDraftOf(doc, active, userId) {
    const now = new Date();
    return {
      versionMajor: active.versionMajor,
      versionMinor: maxMinorFor(doc, active.versionMajor) + 1,
      status: 'DRAFT',
      ...cloneVersionContent(active),
      changelog: MinorVersionDefaults.changelog,
      releaseNotes: MinorVersionDefaults.releaseNotes,
      createdBy: userId,
      createdAt: now,
      updatedBy: userId,
      updatedAt: now,
    };
  }

  // A major draft seeded from `seed`, or blank. Its changelog and release
  // notes are left empty on purpose: the activation gate requires the author
  // to write both before a major can be published.
  function majorDraftOf(doc, seed, userId) {
    const now = new Date();
    return {
      versionMajor: maxMajor(doc) + 1,
      versionMinor: 0,
      status: 'DRAFT',
      ...cloneVersionContent(seed),
      changelog: '',
      releaseNotes: '',
      createdBy: userId,
      createdAt: now,
      updatedBy: userId,
      updatedAt: now,
    };
  }

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
    doc.versions.push(minorDraftOf(doc, active, userId));
    await doc.save();
    return doc;
  }

  /**
   * New major draft, seeded from `source` (the "Duplicate" flow) or from the
   * currently active version, falling back to a blank version.
   */
  async function createMajorVersion(id, { source, userId } = {}) {
    const doc = await getDoc(id);
    doc.versions.push(
      majorDraftOf(doc, source || findActiveVersion(doc), userId)
    );
    await doc.save();
    return doc;
  }

  /**
   * A draft version as an import brings it (ADR 0018): its number and content
   * as given, for a document created with it rather than with a blank 1.0.
   */
  function importedDraft(version, userId) {
    const now = new Date();
    return {
      versionMajor: version.versionMajor,
      versionMinor: version.versionMinor,
      status: 'DRAFT',
      ...cloneVersionContent(version),
      changelog: version.changelog || '',
      releaseNotes: version.releaseNotes || '',
      createdBy: userId,
      createdAt: now,
      updatedBy: userId,
      updatedAt: now,
    };
  }

  /**
   * New draft at a number given rather than the next one: an imported version
   * keeps the number it has on the instance it comes from (ADR 0018). Only
   * ahead of the active version, and never beside an open draft, which an
   * import does not overwrite.
   */
  async function createVersionAt(id, { major, minor }, content, userId) {
    const doc = await getDoc(id);
    const wanted = { versionMajor: major, versionMinor: minor };
    const open = openDraftOf(doc);
    if (open) {
      throw createError(
        409,
        `The draft ${versionLabel(open)} is open on this ${entityNoun}`
      );
    }
    const active = findActiveVersion(doc);
    const ahead =
      !active ||
      major > active.versionMajor ||
      (major === active.versionMajor && minor > active.versionMinor);
    if (!ahead || findVersion(doc, major, minor)) {
      throw createError(
        409,
        `Version ${versionLabel(
          wanted
        )} is not ahead of this ${entityNoun}'s versions`
      );
    }
    const now = new Date();
    doc.versions.push({
      ...wanted,
      status: 'DRAFT',
      ...cloneVersionContent(content),
      changelog: content.changelog || '',
      releaseNotes: content.releaseNotes || '',
      createdBy: userId,
      createdAt: now,
      updatedBy: userId,
      updatedAt: now,
    });
    await doc.save();
    return doc;
  }

  /**
   * A person's change to a draft: `patch.updatedAt`, when given, is the
   * update date of the draft the screen read (readAtOf).
   */
  async function updateVersion(id, { major, minor }, patch, userId) {
    const doc = await getDoc(id);
    const version = findVersion(doc, major, minor);
    assertDraft(version);
    const readAt = readAtOf(version, patch.updatedAt);
    for (const key of PATCHABLE_VERSION_FIELDS) {
      if (patch[key] !== undefined) version[key] = patch[key];
    }
    version.updatedBy = userId;
    version.updatedAt = laterThan(readAt);
    await saveIfUnchanged(doc, version, readAt);
    return doc;
  }

  // The assistant's way to a draft (ADR 0014), one open at a time, each
  // write conditioned on what it read: versioned-draft.js.
  const drafts = createDraftWriter({
    model,
    idField,
    entityNoun,
    getDoc,
    minorDraftOf,
    majorDraftOf,
    patchable: PATCHABLE_VERSION_FIELDS,
  });

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
   * pointer. `payload.openToAll` opens the item to every company in the same
   * write (ADR 0013), so a publication never stands half done.
   * `payload.updatedAt`, when given, is the update date of the draft the
   * screen read: a draft written since is not published unread (readAtOf).
   */
  async function activateVersion(id, { major, minor }, payload = {}, userId) {
    const doc = await getDoc(id);
    const version = findVersion(doc, major, minor);
    if (!version) throw createError(404, `Version ${major}.${minor} not found`);
    if (version.status !== 'DRAFT') {
      throw createError(409, 'Only DRAFT versions can be activated');
    }
    const readAt = readAtOf(version, payload.updatedAt);

    if (activationGate) await activationGate(version, doc);

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
    version.updatedAt = laterThan(readAt);
    doc.activeVersion = {
      major: version.versionMajor,
      minor: version.versionMinor,
    };
    doc.status = SkillStatuses.ACTIVE;
    if (payload.openToAll === true) doc.audience = Audiences.ALL;
    await saveIfUnchanged(doc, version, readAt);
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
    openOrStartDraft: drafts.openOrStartDraft,
    writeDraftIfUnchanged: drafts.writeDraftIfUnchanged,
    createVersionAt,
    importedDraft,
    updateVersion,
    deleteVersion,
    activateVersion,
    archive,
    PATCHABLE_VERSION_FIELDS,
  };
}

module.exports = { createVersionedEntityService };
