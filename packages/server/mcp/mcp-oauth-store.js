'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const logger = require('../utils/logger.js');

/**
 * Where LePatron's authorization server keeps what it issues (ADR 0012), in
 * the app's MongoDB, one collection per model of `oidc-provider`: read and
 * written by the adapter (mcp-oauth-adapter.js), and revoked here without the
 * provider, by whatever ends a connection: a user, an admin, the app's
 * events, a script.
 *
 * A record is `{ _id, payload, grantId?, uid?, consumed?, expiresAt? }`:
 *
 * - `payload` is the model's payload as JSON. MongoDB before 5.0 refuses to
 *   store a key with a dot, and a grant names its resource by its URL.
 * - `grantId` and `uid` are copied out of it, for what is read or revoked by
 *   them, and indexed.
 * - `consumed`, when a code or a refresh token was used.
 * - `expiresAt`, when it expires: a TTL index removes it then.
 *
 * What a client presents as its credential, the access token, the refresh
 * token and the authorization code, is kept under its digest, and its
 * payload without it; a client's secret is kept as its digest too: the store
 * alone gives none of them.
 */

const COLLECTION_PREFIX = 'mcp_oauth_';

// A `$in` of at most this many ids per query.
const BATCH = 500;

// What a grant issues: revoked with it.
const ISSUED_BY_GRANT = ['AccessToken', 'RefreshToken', 'AuthorizationCode'];
// What a client presents as its credential: kept under its digest. The
// others are no credential: a grant is used through the tokens it issued,
// and a login or a pending consent through a cookie the provider signs.
const HASHED = new Set(ISSUED_BY_GRANT);

/**
 * The SHA-256 digest of a value, in base64url.
 *
 * @param {string} value
 * @returns {string}
 */
const digest = (value) =>
  crypto.createHash('sha256').update(String(value)).digest('base64url');

/**
 * The `_id` a model's record is kept under: the digest of a credential
 * (`HASHED`), any other id as it is.
 *
 * @param {string} model a model of `oidc-provider`
 * @param {string} id
 * @returns {string}
 */
const storedId = (model, id) => (HASHED.has(model) ? digest(id) : id);

// A client's secret, as kept: marked, so a secret read back and kept again
// (keepRegisteredClient) is not digested twice.
const SECRET_DIGEST = 'sha256:';

/**
 * A client's secret as it is kept: its digest. The secret itself is only
 * answered once, when the client is created.
 *
 * @param {string} secret the secret, or its digest already
 * @returns {string}
 */
const secretDigest = (secret) =>
  String(secret).startsWith(SECRET_DIGEST)
    ? secret
    : `${SECRET_DIGEST}${digest(secret)}`;

/**
 * Whether a client presents the secret whose digest is kept.
 *
 * @param {string} kept the digest, as `secretDigest` gave it
 * @param {string} presented
 * @returns {boolean}
 */
function isSecretOf(kept, presented) {
  if (typeof kept !== 'string' || typeof presented !== 'string') return false;
  const expected = Buffer.from(kept);
  const actual = Buffer.from(`${SECRET_DIGEST}${digest(presented)}`);
  return (
    expected.length === actual.length &&
    crypto.timingSafeEqual(expected, actual)
  );
}

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

function batchesOf(ids) {
  const batches = [];
  for (let start = 0; start < ids.length; start += BATCH) {
    batches.push(ids.slice(start, start + BATCH));
  }
  return batches;
}

/**
 * Revokes grants and every token they issued, from the store alone: one
 * query per model for up to `BATCH` grants.
 *
 * @param {string[]} grantIds
 */
async function revokeByGrantIds(grantIds) {
  if (grantIds.length === 0) return;
  const issued = await Promise.all(ISSUED_BY_GRANT.map(collectionOf));
  const grants = await collectionOf('Grant');
  await Promise.all(
    batchesOf(grantIds).flatMap((batch) => [
      ...issued.map((collection) =>
        collection.deleteMany({ grantId: { $in: batch } })
      ),
      grants.deleteMany({ _id: { $in: batch } }),
    ])
  );
}

/**
 * Forgets the clients the authorization server keeps under these ids, their
 * secrets with them.
 *
 * @param {string[]} clientIds
 */
async function forgetClients(clientIds) {
  if (clientIds.length === 0) return;
  const clients = await collectionOf('Client');
  await Promise.all(
    batchesOf(clientIds).map((batch) =>
      clients.deleteMany({ _id: { $in: batch } })
    )
  );
}

module.exports = {
  collectionOf,
  revokeByGrantIds,
  forgetClients,
  storedId,
  digest,
  secretDigest,
  isSecretOf,
  HASHED,
  ISSUED_BY_GRANT,
};
