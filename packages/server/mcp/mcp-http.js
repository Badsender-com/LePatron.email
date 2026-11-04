'use strict';

const { createMcpHandler } = require('@modelcontextprotocol/server');
const { toNodeHandler } = require('@modelcontextprotocol/node');
const logger = require('../utils/logger.js');
const { createRateLimiter, clientIp } = require('../utils/rate-limit.js');
const { createMcpServer } = require('./mcp-server.js');
const { resolveIdentity, READ_SCOPE } = require('./mcp-identity.js');
const { createAuthorizationServer, identityOf } = require('./mcp-oauth.js');
const { createInteractionsRouter } = require('./mcp-oauth-interactions.js');
const { createClientsRouter, isClientAllowed } = require('./mcp-clients.js');
const {
  useConnection,
  createConnectionsRouter,
  createGroupConnectionsRouter,
} = require('./mcp-connections.js');

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const limit = (windowMs, max) =>
  createRateLimiter({ windowMs, max, keyOf: clientIp });

const RESOURCE_PATH = '/mcp';
const ISSUER_PATH = '/oauth';

// A refusal before any MCP exchange answers as the SDK's own bearer gate does:
// the OAuth error body (RFC 6750). Clients act on the status and the
// challenge; -32001 is the SDK's "Session not found", not a refusal.
function refuse(res, status, error, description, headers = {}) {
  res.set(headers);
  res.status(status).json({ error, error_description: description });
}

/**
 * The identity a bearer token carries, when it is an access token LePatron
 * issued for the MCP endpoint and still valid.
 */
async function authInfoOf(provider, header, resource) {
  const [kind, value] = String(header || '').split(' ');
  if (kind !== 'Bearer' || !value) return null;
  const token = await provider.AccessToken.find(value);
  if (!token || token.isExpired || token.aud !== resource) return null;
  const identity = identityOf(token.accountId);
  if (!(await isClientAllowed(token.clientId, identity.groupId))) return null;
  // Revoked by its user or the group's admin: refused at once.
  if (!(await useConnection(token.grantId))) return null;
  return {
    token: value,
    clientId: token.clientId,
    scopes: String(token.scope || '')
      .split(' ')
      .filter(Boolean),
    expiresAt: token.exp,
    resource: new URL(resource),
    // The grant's connection keeps the drafts mode (#1385).
    extra: { ...identity, grantId: token.grantId },
  };
}

/**
 * Mounts the MCP endpoint and LePatron's authorization server on the app
 * (ADR 0012): the metadata a connected application discovers them by
 * (RFC 9728, RFC 8414), the authorization server under `/oauth`, the consent
 * API the consent page reads (`/oauth/consent/:uid/…`), the clients a super
 * company registers (`/api/groups/:groupId/mcp-clients`), the connected applications a user or a
 * group's admin revokes (`/api/connected-applications`,
 * `/api/groups/:groupId/connected-applications`), and `/mcp`, which
 * takes only the access tokens issued for it. The consent page itself,
 * `/oauth/consent/:uid`, is the UI's.
 *
 * Mount after the session and passport: the consent API reads the app's user.
 *
 * @param {import('express').Application} app
 * @param {Object} options
 * @param {string} options.origin the site's public origin
 * @param {string[]} options.cookieKeys
 * @param {Function} [options.adapter] see createAuthorizationServer
 * @param {Object} [options.jwks]
 * @param {Function} [options.fetch]
 * @returns {import('oidc-provider').default} the authorization server
 */
function mountMcp(app, { origin, ...providerOptions }) {
  const resource = `${origin}${RESOURCE_PATH}`;
  const issuer = `${origin}${ISSUER_PATH}`;
  const resourceMetadataUrl = `${origin}/.well-known/oauth-protected-resource${RESOURCE_PATH}`;
  const provider = createAuthorizationServer({
    issuer,
    resource,
    ...providerOptions,
  });
  // The provider builds the URLs it publishes from the request: it is handed
  // the site's public origin, never what a Host header claims.
  provider.proxy = true;
  const publicOrigin = new URL(origin);
  const callback = provider.callback();
  const providerCallback = (req, res) => {
    req.headers['x-forwarded-proto'] = publicOrigin.protocol.slice(0, -1);
    req.headers['x-forwarded-host'] = publicOrigin.host;
    return callback(req, res);
  };

  app.get(`/.well-known/oauth-protected-resource${RESOURCE_PATH}`, (req, res) =>
    res.json({
      resource,
      authorization_servers: [issuer],
      scopes_supported: [READ_SCOPE],
      bearer_methods_supported: ['header'],
      resource_name: 'LePatron',
    })
  );

  // RFC 8414 puts the issuer's path after the well-known segment; the
  // provider answers its own discovery document.
  app.get(
    `/.well-known/oauth-authorization-server${ISSUER_PATH}`,
    (req, res) => {
      req.url = '/.well-known/openid-configuration';
      req.originalUrl = `${ISSUER_PATH}${req.url}`;
      providerCallback(req, res);
    }
  );

  // Nothing under /oauth is framed by another site, the consent page
  // included: a click on Allow is the user's own, whatever cookies a browser
  // sends to a frame.
  app.use(ISSUER_PATH, (req, res, next) => {
    res.set('Content-Security-Policy', "frame-ancestors 'none'");
    res.set('X-Frame-Options', 'DENY');
    next();
  });

  // Per address. The token and registration endpoints are called by the
  // assistants' servers, which many users share: generous, against floods.
  // The authorization endpoint fetches the metadata document a client names.
  app.use(`${ISSUER_PATH}/auth`, limit(MINUTE, 60));
  app.use(`${ISSUER_PATH}/consent`, limit(MINUTE, 120));
  app.use(`${ISSUER_PATH}/token`, limit(MINUTE, 600));
  app.use(`${ISSUER_PATH}/reg`, limit(HOUR, 100));

  // Under the consent page's path, where the provider's interaction cookie
  // is sent (see mcp-oauth-interactions.js).
  app.use(
    `${ISSUER_PATH}/consent`,
    createInteractionsRouter(provider, resource)
  );

  // The clients a company registers, kept by the authorization server.
  app.use('/api/groups/:groupId/mcp-clients', createClientsRouter(provider));
  // The applications a user connected, and a group's, which they revoke.
  app.use('/api/connected-applications', createConnectionsRouter(provider));
  app.use(
    '/api/groups/:groupId/connected-applications',
    createGroupConnectionsRouter(provider)
  );

  // Everything else under /oauth is the provider's; the consent page itself
  // is the UI's. Express hands the provider the path without the mount point,
  // as it expects.
  app.use(ISSUER_PATH, (req, res, next) =>
    req.path.startsWith('/consent/') ? next() : providerCallback(req, res)
  );

  const mcpHandler = toNodeHandler(
    createMcpHandler(({ authInfo }) => createMcpServer({ authInfo }), {
      onerror: (error) => logger.error('[mcp]', error.message),
    })
  );
  const discovery = `resource_metadata="${resourceMetadataUrl}", scope="${READ_SCOPE}"`;
  // No error code when no token was sent (RFC 6750, section 3.1).
  const challengeOf = (header) => ({
    'WWW-Authenticate': header
      ? `Bearer error="invalid_token", ${discovery}`
      : `Bearer ${discovery}`,
  });

  app.all(RESOURCE_PATH, async (req, res, next) => {
    try {
      const authInfo = await authInfoOf(
        provider,
        req.headers.authorization,
        resource
      );
      if (!authInfo) {
        return refuse(
          res,
          401,
          'invalid_token',
          'A valid access token is required.',
          challengeOf(req.headers.authorization)
        );
      }
      // What the token said at consent may no longer hold: say so before any
      // MCP exchange, with the HTTP status a client acts on. Not
      // insufficient_scope, which would send the client back to consent.
      try {
        await resolveIdentity(authInfo);
      } catch (refusal) {
        return refuse(res, 403, 'access_denied', refusal.message);
      }
      req.auth = authInfo;
      return mcpHandler(req, res, req.body);
    } catch (err) {
      return next(err);
    }
  });

  return provider;
}

module.exports = { mountMcp };
