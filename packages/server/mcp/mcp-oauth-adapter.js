'use strict';

const { collectionOf } = require('./mcp-oauth-store.js');

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
 * model. A record goes when it expires, by a TTL index.
 */
class McpOAuthAdapter {
  constructor(name) {
    this.name = name;
  }

  collection() {
    return collectionOf(this.name);
  }

  async upsert(id, payload, expiresIn) {
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : null;
    await (await this.collection()).updateOne(
      { _id: id },
      {
        $set: {
          payload: JSON.stringify(payload),
          ...(payload.grantId && { grantId: payload.grantId }),
          ...(payload.uid && { uid: payload.uid }),
          ...(expiresAt && { expiresAt }),
        },
      },
      { upsert: true }
    );
  }

  async find(id) {
    return payloadOf(await (await this.collection()).findOne({ _id: id }));
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
      { _id: id },
      { $set: { consumed: Math.floor(Date.now() / 1000) } }
    );
  }

  async destroy(id) {
    await (await this.collection()).deleteOne({ _id: id });
  }

  async revokeByGrantId(grantId) {
    await (await this.collection()).deleteMany({ grantId });
  }
}

module.exports = { McpOAuthAdapter };
