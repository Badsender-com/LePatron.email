'use strict';

const {
  collectionOf,
  storedId,
  secretDigest,
  isSecretOf,
  HASHED,
} = require('./mcp-oauth-store.js');
const {
  isRegisteredByHand,
  registeredClientMetadata,
} = require('./mcp-clients.js');

// The payload a record keeps, with when it was consumed, or nothing for a
// record of another form.
function payloadOf(record) {
  if (!record || typeof record.payload !== 'string') return undefined;
  const payload = JSON.parse(record.payload);
  return record.consumed ? { ...payload, consumed: record.consumed } : payload;
}

/**
 * The storage of LePatron's authorization server (ADR 0012): `oidc-provider`'s
 * adapter interface over the store of mcp-oauth-store.js, one collection per
 * model. A record goes when it expires, by a TTL index. An access token, a
 * refresh token or a code is kept under its digest, and found by its value;
 * a client's secret is kept as its digest, which the provider compares with
 * the secret presented (`compareClientSecretsByDigest`).
 */
class McpOAuthAdapter {
  constructor(name) {
    this.name = name;
  }

  collection() {
    return collectionOf(this.name);
  }

  // The `_id` of a record: a credential's digest (mcp-oauth-store.js).
  storedId(id) {
    return storedId(this.name, id);
  }

  // A client registered by hand is kept by the company's settings alone
  // (mcp-clients.js), its id given there.
  isClientRegisteredByHand(id) {
    return this.name === 'Client' && isRegisteredByHand(id);
  }

  async upsert(id, payload, expiresIn) {
    if (this.isClientRegisteredByHand(id)) {
      throw new Error('A client registered by hand is kept by its company.');
    }
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : null;
    await (await this.collection()).updateOne(
      { _id: this.storedId(id) },
      {
        $set: {
          payload: JSON.stringify(this.kept(payload)),
          ...(payload.grantId && { grantId: payload.grantId }),
          ...(payload.uid && { uid: payload.uid }),
          ...(expiresAt && { expiresAt }),
        },
      },
      { upsert: true }
    );
  }

  // What a payload is kept as: a credential's never names it (`find` gives
  // it back), a client's secret is kept as its digest.
  kept(payload) {
    if (HASHED.has(this.name)) {
      const { jti: _jti, ...kept } = payload;
      return kept;
    }
    if (this.name === 'Client' && payload.client_secret) {
      return { ...payload, client_secret: secretDigest(payload.client_secret) };
    }
    return payload;
  }

  async find(id) {
    if (this.isClientRegisteredByHand(id)) return registeredClientMetadata(id);
    const payload = payloadOf(
      await (await this.collection()).findOne({ _id: this.storedId(id) })
    );
    return payload && HASHED.has(this.name) ? { ...payload, jti: id } : payload;
  }

  async findByUid(uid) {
    return payloadOf(await (await this.collection()).findOne({ uid }));
  }

  // No device flow here: nothing is ever stored by user code.
  // eslint-disable-next-line class-methods-use-this
  async findByUserCode() {
    return undefined;
  }

  async consume(id) {
    await (await this.collection()).updateOne(
      { _id: this.storedId(id) },
      { $set: { consumed: Math.floor(Date.now() / 1000) } }
    );
  }

  async destroy(id) {
    await (await this.collection()).deleteOne({ _id: this.storedId(id) });
  }

  async revokeByGrantId(grantId) {
    await (await this.collection()).deleteMany({ grantId });
  }
}

/**
 * Has the authorization server compare the secret a client presents with the
 * digest the adapter keeps of it.
 *
 * @param {import('oidc-provider').default} provider
 */
function compareClientSecretsByDigest(provider) {
  Object.assign(provider.Client.prototype, {
    async compareClientSecret(presented) {
      return isSecretOf(this.clientSecret, presented);
    },
  });
}

module.exports = { McpOAuthAdapter, compareClientSecretsByDigest };
