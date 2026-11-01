'use strict';

const mongoose = require('mongoose');

// Kept by the provider, one collection per kind: grants, codes, tokens,
// sessions, interactions, and the clients that registered (DCR).
const COLLECTION_PREFIX = 'mcp_oauth_';
const GRANTABLE = new Set([
  'AccessToken',
  'AuthorizationCode',
  'RefreshToken',
  'DeviceCode',
  'BackchannelAuthenticationRequest',
]);

const indexed = new Set();

/**
 * The storage of LePatron's authorization server (ADR 0012), in the app's
 * MongoDB: `oidc-provider`'s adapter interface over one collection per model.
 * A record goes when it expires, by a TTL index.
 */
class McpOAuthAdapter {
  constructor(name) {
    this.name = name;
  }

  async collection() {
    const collection = mongoose.connection.db.collection(
      `${COLLECTION_PREFIX}${this.name.toLowerCase()}`
    );
    if (!indexed.has(this.name)) {
      indexed.add(this.name);
      await Promise.all([
        collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        collection.createIndex({ 'payload.uid': 1 }, { sparse: true }),
        ...(GRANTABLE.has(this.name)
          ? [collection.createIndex({ 'payload.grantId': 1 })]
          : []),
      ]);
    }
    return collection;
  }

  async upsert(_id, payload, expiresIn) {
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : null;
    await (await this.collection()).updateOne(
      { _id },
      { $set: { payload, ...(expiresAt && { expiresAt }) } },
      { upsert: true }
    );
  }

  async find(_id) {
    const found = await (await this.collection()).findOne(
      { _id },
      { projection: { payload: 1 } }
    );
    return found ? found.payload : undefined;
  }

  async findByUid(uid) {
    const found = await (await this.collection()).findOne(
      { 'payload.uid': uid },
      { projection: { payload: 1 } }
    );
    return found ? found.payload : undefined;
  }

  // No device flow here: nothing is ever stored by user code.
  // eslint-disable-next-line class-methods-use-this
  async findByUserCode() {
    return undefined;
  }

  async consume(_id) {
    await (await this.collection()).updateOne(
      { _id },
      { $set: { 'payload.consumed': Math.floor(Date.now() / 1000) } }
    );
  }

  async destroy(_id) {
    await (await this.collection()).deleteOne({ _id });
  }

  async revokeByGrantId(grantId) {
    await (await this.collection()).deleteMany({ 'payload.grantId': grantId });
  }
}

module.exports = { McpOAuthAdapter };
