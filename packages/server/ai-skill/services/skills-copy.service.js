'use strict';

/**
 * What a person does on a copy with an item that follows production
 * (ADR 0019): keep it on the copy, so that the follow leaves it alone,
 * follow production again, or duplicate one of its versions into a new item
 * of the copy, to try it without touching what the follow brings.
 */

const createError = require('http-errors');
const ERROR_CODES = require('../../constant/error-codes.js');
const { findVersion } = require('./version-helpers.js');
const { ENTITIES } = require('./skills-export.service.js');
const { copyIdOf, copyItemOf } = require('./skills-copy-item.js');
const source = require('./skills-source-client.js');

// How many items of the copy's own work one item may give, as `.copie`,
// `.copie-2`…: more says something is wrong, not a need.
const MAX_COPIES = 50;

/**
 * A new item of the copy holding versions of `doc`, under the first free
 * `<id>.copie…` id: the copy's own work, moved out by a follow or
 * duplicated by a person.
 *
 * @returns {Promise<string>} its id
 * @throws {HttpError} 409 SKILLS_COPY_ID_TAKEN when no id is free
 */
async function createCopyItem(kind, doc, versions, { now, owner }) {
  const { model: modelOf, idField } = ENTITIES[kind];
  const model = modelOf();
  for (let n = 1; n <= MAX_COPIES; n += 1) {
    const id = copyIdOf(doc[idField], n);
    // eslint-disable-next-line no-await-in-loop
    if (!(await model.exists({ [idField]: id }))) {
      // eslint-disable-next-line no-await-in-loop
      await model.create(copyItemOf(kind, doc, versions, { id, now, owner }));
      return id;
    }
  }
  throw createError(409, ERROR_CODES.SKILLS_COPY_ID_TAKEN, {
    id: doc[idField],
  });
}

/**
 * Refuses what only a copy does, on an instance that follows no production.
 *
 * @throws {HttpError} 409 SKILLS_NOT_A_COPY
 */
function assertCopy() {
  if (!source.isConfigured()) {
    throw createError(409, ERROR_CODES.SKILLS_NOT_A_COPY);
  }
}

async function itemOf(kind, id) {
  const { model, idField } = ENTITIES[kind];
  const doc = await model()
    .findOne({ [idField]: id })
    .lean();
  if (!doc)
    throw createError(404, ERROR_CODES.SKILLS_COPY_ITEM_NOT_FOUND, { id });
  return doc;
}

async function setKept(kind, id, kept) {
  const { model, idField } = ENTITIES[kind];
  return model().findOneAndUpdate(
    { [idField]: id },
    { $set: kept },
    {
      new: true,
    }
  );
}

/**
 * Keeps an item on the copy: the follow no longer touches it, and says only
 * whether production changed. Any item of the copy may be kept, one never
 * followed yet included: an item imported before the copy followed
 * production is taken over by the first follow that finds it there.
 *
 * @param {'skill'|'expertise'} kind
 * @param {string} id
 * @param {*} userId who decides it
 * @returns {Promise<Object>} the item
 * @throws {HttpError} 404
 */
async function keepOnCopy(kind, id, userId) {
  await itemOf(kind, id);
  return setKept(kind, id, {
    keptOnCopy: true,
    keptOnCopyAt: new Date(),
    _keptOnCopyBy: userId,
  });
}

/**
 * Follows production again for an item kept on the copy: at the next
 * follow, what the copy wrote on it leaves for a new item of the copy.
 *
 * @returns {Promise<Object>} the item
 */
async function followProductionAgain(kind, id) {
  await itemOf(kind, id);
  return setKept(kind, id, {
    keptOnCopy: false,
    keptOnCopyAt: null,
    _keptOnCopyBy: null,
  });
}

/**
 * A new item of the copy holding one version of an item, as its draft.
 *
 * @param {'skill'|'expertise'} kind
 * @param {string} id
 * @param {{ major: number, minor: number }} ref the version
 * @param {*} userId who duplicates it, its owner
 * @returns {Promise<Object>} the new item
 * @throws {HttpError} 404 SKILLS_COPY_ITEM_NOT_FOUND or
 *   SKILLS_COPY_VERSION_NOT_FOUND
 */
async function duplicateOnCopy(kind, id, { major, minor }, userId) {
  const doc = await itemOf(kind, id);
  const version = findVersion(doc, major, minor);
  if (!version) {
    throw createError(404, ERROR_CODES.SKILLS_COPY_VERSION_NOT_FOUND, {
      id,
      version: `${major}.${minor}`,
    });
  }
  // A duplicate tries something: it addresses none of the retex the
  // version cites, which its publication would close (ADR 0021).
  const copyId = await createCopyItem(
    kind,
    doc,
    [{ ...version, retexIds: [] }],
    {
      now: new Date(),
      owner: userId,
    }
  );
  const { model, idField } = ENTITIES[kind];
  return model().findOne({ [idField]: copyId });
}

module.exports = {
  assertCopy,
  createCopyItem,
  keepOnCopy,
  followProductionAgain,
  duplicateOnCopy,
};
