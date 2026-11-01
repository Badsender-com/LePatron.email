'use strict';

const {
  createMcpHandler,
  ProtocolError,
} = require('@modelcontextprotocol/server');
const { toNodeHandler } = require('@modelcontextprotocol/node');
const logger = require('../utils/logger.js');
const { createRateLimiter, clientIp } = require('../utils/rate-limit.js');
const { createMcpServer } = require('./mcp-server.js');
const { resolveIdentity, READ_SCOPE } = require('./mcp-identity.js');
const { createAuthorizationServer, identityOf } = require('./mcp-oauth.js');
const { createInteractionsRouter } = require('./mcp-oauth-interactions.js');
const { createClientsRouter } = require('./mcp-clients.js');

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const limit = (windowMs, max) =>
  createRateLimiter({ windowMs, max, keyOf: clientIp });

const RESOURCE_PATH = '/mcp';
const ISSUER_PATH = '/oauth';

function jsonRpcError(res, status, message, headers = {}) {
  res.set(headers);
  res.status(status).json({
    jsonrpc: '2.0',
    id: null,
    error: { code: -32001, message },
  });
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
  return {
    token: value,
    clientId: token.clientId,
    scopes: String(token.scope || '')
      .split(' ')
      .filter(Boolean),
    expiresAt: token.exp,
    resource: new URL(resource),
    extra: identityOf(token.accountId),
  };
}

/**
 * Mounts the MCP endpoint and LePatron's authorization server on the app
 * (ADR 0012): the metadata a connected application discovers them by
 * (RFC 9728, RFC 8414), the authorization server under `/oauth`, the consent
 * API the consent page reads (`/oauth/consent/:uid/…`), the clients a super
 * admin registers (`/api/mcp-clients`), and `/mcp`, which
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

  // The clients a super admin registers, kept by the authorization server.
  app.use('/api/mcp-clients', createClientsRouter(provider));

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
  const challenge = {
    'WWW-Authenticate': `Bearer resource_metadata="${resourceMetadataUrl}", scope="${READ_SCOPE}"`,
  };

  app.all(RESOURCE_PATH, async (req, res, next) => {
    try {
      const authInfo = await authInfoOf(
        provider,
        req.headers.authorization,
        resource
      );
      if (!authInfo) {
        return jsonRpcError(
          res,
          401,
          'A valid access token is required.',
          challenge
        );
      }
      // What the token said at consent may no longer hold: say so before any
      // MCP exchange, with the HTTP status a client acts on.
      try {
        await resolveIdentity(authInfo);
      } catch (refusal) {
        // A refusal says why; anything else is a failure of the server,
        // which the error handler logs and answers without its message.
        if (!(refusal instanceof ProtocolError)) throw refusal;
        return jsonRpcError(res, 403, refusal.message);
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
