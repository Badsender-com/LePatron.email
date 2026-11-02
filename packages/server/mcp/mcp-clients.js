'use strict';

const crypto = require('crypto');
const express = require('express');
const { McpClients } = require('../common/models.common.js');
const permissions = require('../account/permissions.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');
const { revokeConnections } = require('./mcp-connections.js');

// The prefix of the ids given here, which `/mcp` checks are still listed.
const CLIENT_ID_PREFIX = 'lepatron-';
const AUTH_METHODS = ['client_secret_post', 'client_secret_basic'];
const MAX_NAME = 100;
const MAX_REDIRECT_URIS = 10;
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

const refuse = (res, status, message) => res.status(status).json({ message });

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
    return { error: `A name of 1 to ${MAX_NAME} characters is required.` };
  }
  if (
    redirectUris.length === 0 ||
    redirectUris.length > MAX_REDIRECT_URIS ||
    !redirectUris.every(isRedirectUri)
  ) {
    return {
      error: `1 to ${MAX_REDIRECT_URIS} HTTPS redirect URIs are required.`,
    };
  }
  if (!AUTH_METHODS.includes(tokenEndpointAuthMethod)) {
    return { error: `The authentication method is one of ${AUTH_METHODS}.` };
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
 * The clients a super admin registers by hand (ADR 0012), for the assistants
 * that cannot register themselves (Copilot Studio in manual mode). The
 * secret is answered once, at creation: the authorization server keeps it
 * with the clients that registered, and the list never shows it. Deleting a
 * client stops it at once, its access tokens included (see mcp-http.js).
 *
 * @param {import('oidc-provider').default} provider
 * @returns {express.Router}
 */
function createClientsRouter(provider) {
  const router = express.Router();
  const { adapter } = provider.Client;

  // As the app's guards: the session's user, the configuration's admin too.
  router.use((req, res, next) => {
    if (!req.user) return refuse(res, 401, 'Log in to LePatron first.');
    if (!permissions.can(req.user, CAPABILITIES.PLATFORM_MANAGE)) {
      return refuse(res, 403, 'Only a super admin manages MCP clients.');
    }
    return next();
  });

  router.get('/', async (req, res, next) => {
    try {
      const clients = await McpClients.find({}).sort({ createdAt: -1 }).lean();
      res.json({ items: clients.map(listed) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const { fields, error } = clientFieldsOf(req.body);
      if (error) return refuse(res, 400, error);
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
        return refuse(res, 400, invalid.error_description || invalid.message);
      }
      // Listed first: a client the authorization server keeps is never one
      // the back office cannot delete.
      const client = await McpClients.create({
        clientId,
        ...fields,
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
      const { clientId } = req.params;
      if (!(await McpClients.findOne({ clientId }).lean())) {
        return refuse(res, 404, 'No such client.');
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
 * Whether the client of an access token may still call: a client registered
 * here must still be listed, so deleting it cuts its tokens at once.
 *
 * @param {string} clientId
 * @returns {Promise<boolean>}
 */
async function isClientAllowed(clientId) {
  if (!String(clientId).startsWith(CLIENT_ID_PREFIX)) return true;
  return !!(await McpClients.findOne({ clientId }).lean());
}

module.exports = { createClientsRouter, isClientAllowed };
