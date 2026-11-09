'use strict';

const { McpConnections } = require('../common/models.common.js');
const logger = require('../utils/logger.js');
const {
  batchesOf,
  revokeByGrantIds,
  revokeEverything,
} = require('./mcp-oauth-store.js');

// The last use is noted once a minute at most: `/mcp` is called often.
const USE_NOTED_EVERY = 60 * 1000;
const MAX_NOTED = 10000;
const notedAt = new Map();

// Mongoose 5 answers `n`, later versions `matchedCount`.
const matchedOne = (result) =>
  (typeof result.n === 'number' ? result.n : result.matchedCount) > 0;

// The connections a user keeps through one application for one company: one
// per consent, so an assistant installed on several machines, under the same
// client id, keeps each. Beyond, the oldest are revoked.
const MAX_CONNECTIONS = 10;

/**
 * Records a connected application, at its consent (ADR 0012): one connection
 * per consent, the previous ones kept. Past `cap` connections of the user
 * through this client for this company, the oldest are revoked.
 *
 * @param {Object} connection
 * @param {string} connection.grantId
 * @param {string} connection.clientId
 * @param {string} connection.clientName
 * @param {string} connection.userId
 * @param {string} connection.groupId
 * @param {number} connection.ttl the grant's lifetime, in seconds
 * @param {number} [connection.cap] how many such connections are kept
 * @returns {Promise<Object>} the connection recorded
 */
async function recordConnection({
  grantId,
  clientId,
  clientName,
  userId,
  groupId,
  ttl,
  cap = MAX_CONNECTIONS,
}) {
  const now = new Date();
  const connection = await McpConnections.create({
    grantId,
    clientId,
    clientName,
    _user: userId,
    _company: groupId,
    connectedAt: now,
    lastUsedAt: null,
    expiresAt: new Date(now.getTime() + ttl * 1000),
  });
  const beyond = await McpConnections.find({
    _user: userId,
    _company: groupId,
    clientId,
  })
    .sort({ connectedAt: -1, _id: -1 })
    .skip(cap)
    .select('grantId')
    .lean();
  if (beyond.length > 0) {
    await revokeConnections({
      grantId: { $in: beyond.map((oldest) => oldest.grantId) },
    });
  }
  return connection;
}

/**
 * Whether the connection of a grant still stands, noting its use: `/mcp`
 * asks at every call, so a revoked application is refused at its next one.
 *
 * @param {string} grantId
 * @returns {Promise<boolean>}
 */
async function useConnection(grantId) {
  if (!grantId) return false;
  const now = Date.now();
  if (now - (notedAt.get(grantId) || 0) < USE_NOTED_EVERY) {
    return McpConnections.exists({ grantId });
  }
  const stands = matchedOne(
    await McpConnections.updateOne(
      { grantId },
      { $set: { lastUsedAt: new Date(now) } }
    )
  );
  if (notedAt.size >= MAX_NOTED) notedAt.clear();
  if (stands) notedAt.set(grantId, now);
  return stands;
}

/**
 * Revokes connected applications: unlisted first, which stops them at
 * `/mcp` at once, then their grants and every token they issued, which
 * stops their refresh. From the store alone: the authorization server need
 * not be mounted (a script).
 *
 * What ends them on an event of the app too (a company turning MCP off, or
 * deleted, a change of a user's credentials): neither their calls nor their
 * refresh go on, and turning MCP back on, or the user, revives none of them.
 *
 * It takes the filter alone, which names some connections: every one of them
 * is revokeAllConnections's, and a call in another form is refused.
 *
 * @param {Object} filter which connections
 */
async function revokeConnections(filter, ...more) {
  if (
    more.length > 0 ||
    !filter ||
    typeof filter !== 'object' ||
    Object.keys(filter).length === 0
  ) {
    throw new TypeError('revokeConnections takes a filter of connections');
  }
  const connections = await McpConnections.find(filter)
    .select('grantId')
    .lean();
  if (connections.length === 0) return;
  const grantIds = connections.map(({ grantId }) => grantId);
  // The very connections read, by batches: one consented meanwhile stays
  // whole.
  await Promise.all(
    batchesOf(grantIds).map((batch) =>
      McpConnections.deleteMany({ grantId: { $in: batch } })
    )
  );
  // Unlisted, they are already refused at `/mcp`: a grant or a token that
  // could not be revoked only mints tokens `/mcp` refuses, until it expires.
  await revokeByGrantIds(grantIds).catch((error) =>
    logger.error('[mcp-oauth] revoke grants', error.message)
  );
}

/**
 * Revokes every connected application of every company at once: unlisted,
 * then every grant and every token, every login and pending consent of the
 * authorization server. The clients stay registered: their users connect
 * again. What scripts/mcp-revoke-all.js runs.
 *
 * @returns {Promise<Object<string, number>>} how many went: `connections`,
 *   and by model of the authorization server
 */
async function revokeAllConnections() {
  const { deletedCount } = await McpConnections.deleteMany({});
  return { connections: deletedCount, ...(await revokeEverything()) };
}

/**
 * Binds the connections to the authorization server: the connection of a
 * grant it revoked itself (a client revoking its refresh token) goes.
 *
 * @param {import('oidc-provider').default} provider
 */
function attachAuthorizationServer(provider) {
  provider.on('grant.revoked', (ctx, grantId) =>
    McpConnections.deleteOne({ grantId }).catch((error) =>
      logger.error('[mcp-oauth] grant revoked', error.message)
    )
  );
}

module.exports = {
  recordConnection,
  useConnection,
  revokeConnections,
  revokeAllConnections,
  attachAuthorizationServer,
};
