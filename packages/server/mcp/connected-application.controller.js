'use strict';

const createError = require('http-errors');
const asyncHandler = require('express-async-handler');

const ERROR_CODES = require('../constant/error-codes.js');
const { McpConnections, Groups } = require('../common/models.common.js');
const { isObjectIdString } = require('../utils/model.js');
const { revokeConnections } = require('./mcp-connections.js');
const {
  recordSecurityEvent,
} = require('../security-event/security-event.service.js');
const {
  CONNECTED_APPLICATION_ACTIONS,
} = require('../security-event/security-event.actions.js');

// One row per connection, with the name of its company.
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

/**
 * @api {get} /connected-applications The applications the user connected
 * @apiDescription One per consent: an assistant connected from two machines
 * is listed twice (ADR 0012).
 * @apiPermission user
 * @apiGroup MCP
 * @apiSuccess {Object[]} items the latest connected first
 */
async function listOwn(req, res) {
  const connections = await McpConnections.find({ _user: req.user.id })
    .sort({ connectedAt: -1 })
    .lean();
  res.json({ items: await listed(connections) });
}

/**
 * @api {delete} /connected-applications/:id Revokes one of the user's connections
 * @apiDescription Stopped at its next call, its refresh included.
 * @apiPermission user
 * @apiGroup MCP
 * @apiParam {String} id
 */
async function revokeOwn(req, res) {
  const { id } = req.params;
  // Another user's is answered as unknown.
  const filter = { _id: id, _user: req.user.id };
  if (!isObjectIdString(id) || !(await McpConnections.findOne(filter).lean())) {
    throw new createError.NotFound(ERROR_CODES.MCP_CONNECTION_NOT_FOUND);
  }
  await revokeConnections(filter);
  res.status(204).end();
}

/**
 * @api {get} /groups/:groupId/connected-applications How many connections a company has
 * @apiPermission group.manage-tech
 * @apiGroup MCP
 * @apiParam {String} groupId
 * @apiSuccess {Number} count
 */
async function countOfCompany(req, res) {
  const count = await McpConnections.countDocuments({
    _company: req.params.groupId,
  });
  res.json({ count });
}

/**
 * @api {delete} /groups/:groupId/connected-applications Revokes every connection of a company
 * @apiPermission group.manage-tech
 * @apiGroup MCP
 * @apiParam {String} groupId
 */
async function revokeAllOfCompany(req, res) {
  const { groupId } = req.params;
  await revokeConnections({ _company: groupId });
  await recordSecurityEvent({
    action: CONNECTED_APPLICATION_ACTIONS.ALL_REVOKED,
    actor: req.user.id,
    group: groupId,
  });
  res.status(204).end();
}

module.exports = {
  listOwn: asyncHandler(listOwn),
  revokeOwn: asyncHandler(revokeOwn),
  countOfCompany: asyncHandler(countOfCompany),
  revokeAllOfCompany: asyncHandler(revokeAllOfCompany),
};
