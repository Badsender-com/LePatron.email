'use strict';

const createError = require('http-errors');
const asyncHandler = require('express-async-handler');

const ERROR_CODES = require('../constant/error-codes.js');
const { McpClients } = require('../common/models.common.js');
const {
  clientFieldsOf,
  registerClient,
  deleteClient,
} = require('./mcp-clients.js');

// Why clientFieldsOf refuses the fields, as the error code the API answers.
const FIELD_REFUSALS = {
  invalid_name: ERROR_CODES.MCP_CLIENT_INVALID_NAME,
  invalid_redirect_uris: ERROR_CODES.MCP_CLIENT_INVALID_REDIRECT_URIS,
  invalid_auth_method: ERROR_CODES.MCP_CLIENT_INVALID_AUTH_METHOD,
};

// The code, and what is wrong in words, for whoever calls the API by hand.
const invalid = (code, description) =>
  createError(400, code, description ? { description } : {});

// The authorization server mountMcp mounted on the app, which checks a client
// as it would read it.
function authorizationServer(req) {
  const provider = req.app.locals.mcpAuthorizationServer;
  if (!provider) throw new Error('The MCP authorization server is not mounted');
  return provider;
}

const listed = (client) => ({
  clientId: client.clientId,
  name: client.name,
  redirectUris: client.redirectUris,
  tokenEndpointAuthMethod: client.tokenEndpointAuthMethod,
  createdAt: client.createdAt,
});

/**
 * @api {get} /groups/:groupId/mcp-clients The clients a company registered by hand
 * @apiPermission group.manage-tech
 * @apiGroup MCP
 * @apiParam {String} groupId
 * @apiSuccess {Object[]} items the latest first, never with their secret
 */
async function list(req, res) {
  const clients = await McpClients.find({ _company: req.params.groupId })
    .sort({ createdAt: -1 })
    .lean();
  res.json({ items: clients.map(listed) });
}

/**
 * @api {post} /groups/:groupId/mcp-clients Registers a client by hand
 * @apiDescription For the assistants that cannot register themselves
 * (Copilot Studio in manual mode, ADR 0012). The client belongs to the
 * company: its users alone connect through it. Its secret is answered once,
 * here.
 * @apiPermission group.manage-tech
 * @apiGroup MCP
 * @apiParam {String} groupId
 * @apiParam (Body) {String} name 1 to 100 characters
 * @apiParam (Body) {String[]} redirectUris 1 to 10
 * @apiParam (Body) {String} [tokenEndpointAuthMethod] client_secret_post
 *   unless asked, or client_secret_basic
 * @apiSuccess (201) {String} clientId
 * @apiSuccess (201) {String} clientSecret
 */
async function create(req, res) {
  const { fields, error, code } = clientFieldsOf(req.body);
  if (error) throw invalid(FIELD_REFUSALS[code], error);
  const registered = await registerClient(authorizationServer(req), {
    fields,
    groupId: req.params.groupId,
    userId: req.user.id,
  });
  if (registered.error) {
    throw invalid(ERROR_CODES.MCP_CLIENT_INVALID_METADATA, registered.error);
  }
  const { client, clientSecret } = registered;
  res.status(201).json({ ...listed(client), clientSecret });
}

/**
 * @api {delete} /groups/:groupId/mcp-clients/:clientId Deletes a client registered by hand
 * @apiDescription It stops at once, its connected applications and their
 * tokens with it.
 * @apiPermission group.manage-tech
 * @apiGroup MCP
 * @apiParam {String} groupId
 * @apiParam {String} clientId
 */
async function remove(req, res) {
  const { clientId, groupId } = req.params;
  // Another company's is answered as unknown.
  if (!(await deleteClient({ clientId, groupId }))) {
    throw new createError.NotFound(ERROR_CODES.MCP_CLIENT_NOT_FOUND);
  }
  res.status(204).end();
}

module.exports = {
  list: asyncHandler(list),
  create: asyncHandler(create),
  remove: asyncHandler(remove),
};
