'use strict';

const express = require('express');
const { McpConnections, Groups } = require('../common/models.common.js');
const permissions = require('../account/permissions.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');
const { isObjectIdString } = require('../utils/model.js');
const logger = require('../utils/logger.js');

// What a grant may have issued: revoked with it.
const ISSUED_BY_GRANT = ['AccessToken', 'RefreshToken', 'AuthorizationCode'];

const refuse = (res, status, message) => res.status(status).json({ message });

/**
 * Records a connected application, at its consent (ADR 0012).
 *
 * @param {Object} connection
 * @param {string} connection.grantId
 * @param {string} connection.clientId
 * @param {string} connection.clientName
 * @param {string} connection.userId
 * @param {string} connection.groupId
 * @param {number} connection.ttl the grant's lifetime, in seconds
 */
function recordConnection({
  grantId,
  clientId,
  clientName,
  userId,
  groupId,
  ttl,
}) {
  const now = new Date();
  return McpConnections.create({
    grantId,
    clientId,
    clientName,
    _user: userId,
    _company: groupId,
    connectedAt: now,
    lastUsedAt: null,
    expiresAt: new Date(now.getTime() + ttl * 1000),
  });
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
  const { matchedCount } = await McpConnections.updateOne(
    { grantId },
    { $set: { lastUsedAt: new Date() } }
  );
  return matchedCount > 0;
}

/**
 * Revokes connected applications: unlisted first, which stops them at
 * `/mcp` at once, then their grants and every token they issued, which
 * stops their refresh.
 *
 * @param {import('oidc-provider').default} provider
 * @param {Object} filter which connections
 */
async function revokeConnections(provider, filter) {
  const connections = await McpConnections.find(filter)
    .select('grantId')
    .lean();
  if (connections.length === 0) return;
  await McpConnections.deleteMany(filter);
  await Promise.all(
    connections.map(({ grantId }) =>
      Promise.all([
        ...ISSUED_BY_GRANT.map((model) =>
          provider[model].revokeByGrantId(grantId)
        ),
        provider.Grant.adapter.destroy(grantId),
      ])
    )
  );
}

/**
 * Forgets the connection of a grant the authorization server revoked itself
 * (a client revoking its refresh token).
 *
 * @param {import('oidc-provider').default} provider
 */
function forgetRevokedGrants(provider) {
  provider.on('grant.revoked', (ctx, grantId) =>
    McpConnections.deleteOne({ grantId }).catch((error) =>
      logger.error('[mcp-oauth] grant revoked', error.message)
    )
  );
}

async function listed(connections) {
  const groupIds = [...new Set(connections.map((c) => String(c._company)))];
  const groups = await Groups.find({ _id: { $in: groupIds } })
    .select('_id name')
    .lean();
  const nameOf = new Map(
    groups.map((group) => [String(group._id), group.name])
  );
  return connections.map((connection) => ({
    id: String(connection._id),
    name: connection.clientName,
    group: {
      id: String(connection._company),
      name: nameOf.get(String(connection._company)) || '',
    },
    connectedAt: connection.connectedAt,
    lastUsedAt: connection.lastUsedAt,
  }));
}

const signedIn = (req, res, next) =>
  req.user ? next() : refuse(res, 401, 'Log in to LePatron first.');

/**
 * The applications a user connected (ADR 0012), which they list and revoke:
 * `/api/connected-applications`.
 *
 * @param {import('oidc-provider').default} provider
 * @returns {express.Router}
 */
function createConnectionsRouter(provider) {
  const router = express.Router();
  router.use(signedIn);

  router.get('/', async (req, res, next) => {
    try {
      const connections = await McpConnections.find({ _user: req.user.id })
        .sort({ connectedAt: -1 })
        .lean();
      res.json({ items: await listed(connections) });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      // Another user's is answered as unknown.
      const filter = { _id: id, _user: req.user.id };
      if (
        !isObjectIdString(id) ||
        !(await McpConnections.findOne(filter).lean())
      ) {
        return refuse(res, 404, 'No such connected application.');
      }
      await revokeConnections(provider, filter);
      return res.status(204).end();
    } catch (err) {
      return next(err);
    }
  });

  return router;
}

// A super admin, or an admin of this very group.
const canManageGroup = (user, groupId) =>
  permissions.can(user, CAPABILITIES.GROUP_MANAGE) &&
  permissions.canAccessGroup(user, groupId);

/**
 * The connected applications of a group, which its admin counts and revokes
 * at once: `/api/groups/:groupId/connected-applications`.
 *
 * @param {import('oidc-provider').default} provider
 * @returns {express.Router}
 */
function createGroupConnectionsRouter(provider) {
  const router = express.Router({ mergeParams: true });
  router.use(signedIn, (req, res, next) => {
    const { groupId } = req.params;
    if (!isObjectIdString(groupId) || !canManageGroup(req.user, groupId)) {
      return refuse(
        res,
        403,
        "Only the group's admin revokes its connections."
      );
    }
    return next();
  });

  router.get('/', async (req, res, next) => {
    try {
      const count = await McpConnections.countDocuments({
        _company: req.params.groupId,
      });
      res.json({ count });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/', async (req, res, next) => {
    try {
      await revokeConnections(provider, { _company: req.params.groupId });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = {
  recordConnection,
  useConnection,
  revokeConnections,
  forgetRevokedGrants,
  createConnectionsRouter,
  createGroupConnectionsRouter,
};
