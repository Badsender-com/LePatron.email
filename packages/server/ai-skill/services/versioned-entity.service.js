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
  openDraftOf,
  versionLabel,
} = require('./version-helpers.js');

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
   * The draft a change goes to, when there is one: the open draft (the
   * latest one newer than the active version). A major change is never
   * written into an open minor, and an archived document takes no draft.
   *
   * @returns {Object|null} the open draft, or null when one is to be started
   * @throws {HttpError} 409
   */
  function draftToWrite(doc, id, major) {
    if (doc.status === SkillStatuses.ARCHIVED) {
      throw createError(409, `"${id}" is archived: it takes no new draft.`);
    }
    const open = openDraftOf(doc);
    if (open && major && open.versionMinor > 0) {
      throw createError(
        409,
        `The minor draft ${versionLabel(
          open
        )} is open: propose this change to it, or ask a person to publish or discard it before a major version.`
      );
    }
    return open;
  }

  /**
   * The draft a change from an assistant goes to (ADR 0014): the open draft,
   * or a new one started from the active version, so that only one draft is
   * ever open. One read, and a write only when a draft is started, on the
   * condition that the versions did not change since that read: of two
   * changes made at once, the second writes into the draft the first
   * started. The back office keeps starting the drafts it is asked for.
   *
   * @param {string} id
   * @param {Object} [options]
   * @param {boolean} [options.major] a major draft rather than a minor one
   * @param {*} [options.userId]
   * @returns {Promise<{doc: Object, version: Object}>} the document and the
   *   draft
   * @throws {HttpError} 404, or 409 when the document is archived, when a
   *   major is asked while a minor draft is open, or when it changed in a
   *   way that leaves no draft to write
   */
  async function openOrStartDraft(id, { major = false, userId } = {}) {
    const doc = await getDoc(id);
    const open = draftToWrite(doc, id, major);
    if (open) return { doc, version: open };

    // A minor by default, a major on request or when nothing is published
    // yet, as the back office starts them.
    const active = findActiveVersion(doc);
    const draft =
      major || !active
        ? majorDraftOf(doc, active, userId)
        : minorDraftOf(doc, active, userId);
    const written = await model.findOneAndUpdate(
      {
        [idField]: id,
        status: { $ne: SkillStatuses.ARCHIVED },
        versions: { $size: (doc.versions || []).length },
      },
      { $push: { versions: draft } },
      { new: true }
    );
    if (written) {
      return {
        doc: written,
        version: findVersion(written, draft.versionMajor, draft.versionMinor),
      };
    }
    // Another write came first: the draft it started is the one to write.
    const now = await getDoc(id);
    const started = draftToWrite(now, id, major);
    if (started) return { doc: now, version: started };
    throw createError(
      409,
      `The ${entityNoun} "${id}" changed while the draft was started: send the change again.`
    );
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
   * pointer. `payload.openToAll` opens the item to every company in the same
   * write (ADR 0013), so a publication never stands half done.
   */
  async function activateVersion(id, { major, minor }, payload = {}, userId) {
    const doc = await getDoc(id);
    const version = findVersion(doc, major, minor);
    if (!version) throw createError(404, `Version ${major}.${minor} not found`);
    if (version.status !== 'DRAFT') {
      throw createError(409, 'Only DRAFT versions can be activated');
    }

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
    version.updatedAt = now;
    doc.activeVersion = {
      major: version.versionMajor,
      minor: version.versionMinor,
    };
    doc.status = SkillStatuses.ACTIVE;
    if (payload.openToAll === true) doc.audience = Audiences.ALL;
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
    openOrStartDraft,
    updateVersion,
    deleteVersion,
    activateVersion,
    archive,
    PATCHABLE_VERSION_FIELDS,
  };
}

module.exports = { createVersionedEntityService };
