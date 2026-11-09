'use strict';

const mongoose = require('mongoose');
const logger = require('../utils/logger.js');

/**
 * Where LePatron's authorization server keeps what it issues (ADR 0012), in
 * the app's MongoDB, one collection per model of `oidc-provider`, read and
 * written by the adapter (mcp-oauth-adapter.js).
 *
 * A record is `{ _id, payload, grantId?, uid?, consumed?, expiresAt? }`:
 *
 * - `payload` is the model's payload as JSON. MongoDB before 5.0 refuses to
 *   store a key with a dot, and a grant names its resource by its URL.
 * - `grantId` and `uid` are copied out of it, for what is read or revoked by
 *   them, and indexed.
 * - `consumed`, when a code or a refresh token was used.
 * - `expiresAt`, when it expires: a TTL index removes it then.
 */

const COLLECTION_PREFIX = 'mcp_oauth_';

// What a grant issues: revoked with it.
const ISSUED_BY_GRANT = ['AccessToken', 'RefreshToken', 'AuthorizationCode'];

// The indexes of each collection, by database: marked once created, so a
// failure is tried again at the next use.
const indexing = new WeakMap();

function indexesOf(model) {
  return [
    [{ expiresAt: 1 }, { expireAfterSeconds: 0 }],
    ...(ISSUED_BY_GRANT.includes(model) ? [[{ grantId: 1 }, {}]] : []),
    ...(model === 'Session' ? [[{ uid: 1 }, {}]] : []),
  ];
}

function ensureIndexes(db, model, collection) {
  if (!indexing.has(db)) indexing.set(db, new Map());
  const byModel = indexing.get(db);
  if (!byModel.has(model)) {
    byModel.set(
      model,
      Promise.all(
        indexesOf(model).map(([keys, options]) =>
          collection.createIndex(keys, options)
        )
      ).catch((error) => {
        byModel.delete(model);
        logger.error('[mcp-oauth] index', model, error.message);
      })
    );
  }
  return byModel.get(model);
}

/**
 * The collection of a model, its indexes created first.
 *
 * @param {string} model a model of `oidc-provider` (`AccessToken`, `Grant`…)
 * @returns {Promise<import('mongodb').Collection>}
 */
async function collectionOf(model) {
  const { db } = mongoose.connection;
  const collection = db.collection(
    `${COLLECTION_PREFIX}${model.toLowerCase()}`
  );
  await ensureIndexes(db, model, collection);
  return collection;
}

module.exports = { collectionOf, ISSUED_BY_GRANT };
