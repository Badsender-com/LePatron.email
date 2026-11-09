'use strict';

const crypto = require('crypto');
const express = require('express');
const { McpClients, Groups } = require('../common/models.common.js');
const permissions = require('../account/permissions.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');
const { isObjectIdString } = require('../utils/model.js');
const { revokeConnections } = require('./mcp-connections.js');
const { forgetClients } = require('./mcp-oauth-store.js');

// The prefix of the ids given here, which `/mcp` checks are still listed.
const CLIENT_ID_PREFIX = 'lepatron-';
const AUTH_METHODS = ['client_secret_post', 'client_secret_basic'];
const MAX_NAME = 100;
const MAX_REDIRECT_URIS = 10;
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

// `code` is what the back office translates.
const refuse = (res, status, message, code) =>
  res.status(status).json({ message, ...(code && { code }) });

// Where the authorization server may send a code: HTTPS, or a loopback
// address for a client running on the user's machine.
function isRedirectUri(value) {
  try {
    const url = new URL(value);
    return (
      !url.hash &&
      (url.protocol === 'https:' ||
        (url.protocol === 'http:' && LOOPBACK.has(url.hostname)))
    );
  } catch {
    return false;
  }
}

// The new client's fields, or why they are refused.
function clientFieldsOf(body = {}) {
  const name = String(body.name || '').trim();
  const redirectUris = Array.isArray(body.redirectUris)
    ? body.redirectUris.map((uri) => String(uri).trim()).filter(Boolean)
    : [];
  const tokenEndpointAuthMethod =
    body.tokenEndpointAuthMethod || AUTH_METHODS[0];
  if (!name || name.length > MAX_NAME) {
    return {
      error: `A name of 1 to ${MAX_NAME} characters is required.`,
      code: 'invalid_name',
    };
  }
  if (
    redirectUris.length === 0 ||
    redirectUris.length > MAX_REDIRECT_URIS ||
    !redirectUris.every(isRedirectUri)
  ) {
    return {
      error: `1 to ${MAX_REDIRECT_URIS} redirect URIs are required, in HTTPS or to the user's own machine.`,
      code: 'invalid_redirect_uris',
    };
  }
  if (!AUTH_METHODS.includes(tokenEndpointAuthMethod)) {
    return {
      error: `The authentication method is one of ${AUTH_METHODS}.`,
      code: 'invalid_auth_method',
    };
  }
  return { fields: { name, redirectUris, tokenEndpointAuthMethod } };
}

const listed = (client) => ({
  clientId: client.clientId,
  name: client.name,
  redirectUris: client.redirectUris,
  tokenEndpointAuthMethod: client.tokenEndpointAuthMethod,
  createdAt: client.createdAt,
});

/**
 * The clients a company registers by hand (ADR 0012), for the assistants
 * that cannot register themselves (Copilot Studio in manual mode):
 * `/api/groups/:groupId/mcp-clients`, for the company's tech admin or a super
 * admin. A client belongs to its company: its users alone connect through it.
 * The secret is answered once, at creation: the authorization server keeps it
 * with the clients that registered, and the list never shows it. Deleting a
 * client stops it at once, its access tokens included (see mcp-http.js).
 *
 * @param {import('oidc-provider').default} provider
 * @returns {express.Router}
 */
function createClientsRouter(provider) {
  const router = express.Router({ mergeParams: true });
  const { adapter } = provider.Client;

  // As the app's guards: the session's user, the configuration's admin too.
  router.use((req, res, next) => {
    if (!req.user) return refuse(res, 401, 'Log in to LePatron first.');
    const { groupId } = req.params;
    if (
      !isObjectIdString(groupId) ||
      !permissions.can(req.user, CAPABILITIES.GROUP_MANAGE_TECH) ||
      !permissions.canAccessGroup(req.user, groupId)
    ) {
      return refuse(
        res,
        403,
        "Only the company's tech admin manages its MCP clients."
      );
    }
    return next();
  });

  router.get('/', async (req, res, next) => {
    try {
      const clients = await McpClients.find({ _company: req.params.groupId })
        .sort({ createdAt: -1 })
        .lean();
      res.json({ items: clients.map(listed) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const { fields, error, code } = clientFieldsOf(req.body);
      if (error) return refuse(res, 400, error, code);
      const clientId = `${CLIENT_ID_PREFIX}${crypto.randomUUID()}`;
      const clientSecret = crypto.randomBytes(48).toString('base64url');
      const metadata = {
        client_id: clientId,
        client_secret: clientSecret,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_name: fields.name,
        redirect_uris: fields.redirectUris,
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: fields.tokenEndpointAuthMethod,
      };
      // What the authorization server would refuse when the client connects.
      try {
        await provider.Client.validate(metadata);
      } catch (invalid) {
        return refuse(
          res,
          400,
          invalid.error_description || invalid.message,
          'invalid_client_metadata'
        );
      }
      // Listed first: a client the authorization server keeps is never one
      // the back office cannot delete.
      const client = await McpClients.create({
        clientId,
        ...fields,
        _company: req.params.groupId,
        _createdBy: req.user.id,
      });
      await adapter.upsert(clientId, metadata);
      return res.status(201).json({ ...listed(client), clientSecret });
    } catch (err) {
      return next(err);
    }
  });

  router.delete('/:clientId', async (req, res, next) => {
    try {
      const { clientId, groupId } = req.params;
      // Another company's is answered as unknown.
      if (!(await McpClients.findOne({ clientId, _company: groupId }).lean())) {
        return refuse(res, 404, 'No such client.', 'not_found');
      }
      // Stopped first, unlisted after: a failure leaves it listed.
      await adapter.destroy(clientId);
      await revokeConnections(provider, { clientId });
      await McpClients.deleteOne({ clientId });
      return res.status(204).end();
    } catch (err) {
      return next(err);
    }
  });

  return router;
}

/**
 * The company a client registered by hand belongs to, or null for a client
 * that registered itself or publishes its metadata document.
 *
 * @param {string} clientId
 * @returns {Promise<{id: string, name: string}|null>}
 */
async function companyOfClient(clientId) {
  if (!String(clientId).startsWith(CLIENT_ID_PREFIX)) return null;
  const client = await McpClients.findOne({ clientId }).lean();
  if (!client) return null;
  const company = await Groups.findById(client._company).select('name').lean();
  return { id: String(client._company), name: company?.name || '' };
}

/**
 * Whether the client of an access token may still call for this company: a
 * client registered here must still be listed, so deleting it cuts its
 * tokens at once, and serves its own company alone.
 *
 * @param {string} clientId
 * @param {string} groupId the company the token is bound to
 * @returns {Promise<boolean>}
 */
async function isClientAllowed(clientId, groupId) {
  if (!String(clientId).startsWith(CLIENT_ID_PREFIX)) return true;
  const client = await McpClients.findOne({ clientId }).lean();
  return !!client && String(client._company) === String(groupId);
}

/**
 * Forgets the clients a company registered when the company goes, their
 * secrets with them: nothing else would ever delete them.
 *
 * @param {string|Object} groupId
 */
async function forgetCompanyClients(groupId) {
  const clients = await McpClients.find({ _company: groupId })
    .select('clientId')
    .lean();
  await forgetClients(clients.map(({ clientId }) => clientId));
  await McpClients.deleteMany({ _company: groupId });
}

module.exports = {
  createClientsRouter,
  isClientAllowed,
  companyOfClient,
  forgetCompanyClients,
};
