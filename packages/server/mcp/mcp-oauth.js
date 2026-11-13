'use strict';

const express = require('express');
// ESM only: Node 24 lets the app require it (ADR 0012).
const { default: Provider, errors } = require('oidc-provider');
const { McpClients } = require('../common/models.common.js');
const logger = require('../utils/logger.js');
const { attachAuthorizationServer } = require('./mcp-connections.js');
const { compareClientSecretsByDigest } = require('./mcp-oauth-adapter.js');
const { SCOPES } = require('./mcp-identity.js');
const {
  EXTRA_CLIENT_METADATA,
  allowFetch,
  providerFetch,
} = require('./mcp-client-metadata.js');

// Short-lived access tokens, rotating refresh tokens (ADR 0012).
const TTL = {
  AccessToken: 3600,
  AuthorizationCode: 60,
  // The time to log in and consent: a consent link is worth little after.
  Interaction: 600,
  Session: 24 * 3600,
  Grant: 90 * 24 * 3600,
  RefreshToken: 30 * 24 * 3600,
};
// Where the provider answers its discovery document.
const DISCOVERY_PATH = '/.well-known/openid-configuration';

// A client that registered (DCR) and connected nobody since.
const REGISTRATION_TTL = 24 * 3600;

// A client proves itself with its secret, or, public, with PKCE alone.
const CLIENT_AUTH_METHODS = [
  'none',
  'client_secret_post',
  'client_secret_basic',
];

// What an assistant sends the authorization server (a registration, a token
// request) is small: read before the app's own limit of 50 MB, which anyone
// could send to these endpoints, signed in or not.
const BODY_LIMIT = '64kb';

/**
 * The body parsers of `/oauth`, mounted before the app's own.
 *
 * @returns {Function[]}
 */
function oauthBodyParsers() {
  return [
    express.json({ limit: BODY_LIMIT }),
    express.urlencoded({ limit: BODY_LIMIT, extended: false }),
  ];
}

const JWKS_VARIABLE = 'lepatron_mcpOauthJwks';

/**
 * The keys of the authorization server, as `lepatron_mcpOauthJwks` holds
 * them: a JSON Web Key Set with its private keys. Never quoted when it cannot
 * be read: it is a secret.
 *
 * @param {string} text the variable's value
 * @returns {{ keys: Object[] }}
 * @throws {Error} naming the variable, when it is no key set
 */
function jwksOf(text) {
  let jwks;
  try {
    jwks = JSON.parse(text);
  } catch {
    jwks = null;
  }
  if (!Array.isArray(jwks?.keys) || jwks.keys.length === 0) {
    throw new Error(
      `${JWKS_VARIABLE} is not a JSON Web Key Set: set it to {"keys": [...]}, ` +
        'with the private keys of the MCP authorization server.'
    );
  }
  return jwks;
}

const htmlSafe = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[char])
  );

/**
 * The page the browser is shown when an authorization cannot go on (an
 * unknown client, a redirect URI it did not register): the error, and
 * nothing from another site.
 *
 * @param {Object} ctx
 * @param {{ error: string, error_description?: string }} out
 */
function renderError(ctx, out) {
  ctx.type = 'html';
  ctx.body = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>LePatron: connection refused</title>
<style>
body{font-family:system-ui,sans-serif;margin:0;padding:48px 16px;background:#f5f5f5;color:#222}
main{max-width:480px;margin:0 auto;padding:24px;background:#fff;border-radius:8px}
h1{font-size:1.25rem;margin:0 0 12px}
p{line-height:1.5;margin:0 0 12px}
code{word-break:break-word}
</style>
</head>
<body>
<main>
<h1>This application cannot connect to LePatron.</h1>
<p>Close this page and try again from the application. If it happens again, give its publisher this error:</p>
<p><code>${htmlSafe(out.error)}</code>${
    out.error_description ? `: ${htmlSafe(out.error_description)}` : ''
  }</p>
</main>
</body>
</html>`;
}

// The account of a token is a user in the group the connection is bound to,
// so the group survives every refresh.
const accountIdOf = (userId, groupId) => `${userId}.${groupId}`;
function identityOf(accountId) {
  const [userId, groupId] = String(accountId).split('.');
  return { userId, groupId };
}

/**
 * Keeps a client that registered (DCR) for as long as its last connection may
 * be refreshed: open registration would otherwise keep every client forever.
 * A client a company registered by hand (its tech admin, or a super admin)
 * stays until deleted; a client known by its metadata document is not
 * stored.
 *
 * @param {import('oidc-provider').default} provider
 * @param {string} clientId
 * @param {number} [seconds]
 */
async function keepRegisteredClient(provider, clientId, seconds = TTL.Grant) {
  const { adapter } = provider.Client;
  const stored = await adapter.find(clientId);
  if (!stored || (await McpClients.findOne({ clientId }).lean())) return;
  await adapter.upsert(clientId, stored, seconds);
}

/**
 * LePatron's authorization server (ADR 0012), on `oidc-provider`: the
 * authorization code flow with PKCE and the `resource` parameter, for one
 * resource, the MCP endpoint. Clients come by their metadata document (CIMD)
 * or by registering (DCR). The login and the consent are the app's: the
 * provider sends the browser to `/oauth/consent/:uid`.
 *
 * @param {Object} options
 * @param {string} options.issuer the authorization server's URL
 * @param {string} options.resource the MCP endpoint's URL
 * @param {string[]} options.cookieKeys the keys the provider signs its
 *   cookies with
 * @param {Function} [options.adapter] the storage of grants, codes and
 *   tokens; in memory when not given (the tests)
 * @param {Object} [options.jwks] the keys, from `lepatron_mcpOauthJwks`;
 *   the provider's development keys when not given
 * @param {Function} [options.fetch] what sends the provider's requests (a
 *   client's metadata document); the global `fetch` when not given
 * @param {Function} [options.lookup] what resolves a host's name, as
 *   `dns.promises.lookup`
 * @returns {Provider}
 */
function createAuthorizationServer({
  issuer,
  resource,
  cookieKeys,
  adapter,
  jwks,
  fetch,
  lookup,
}) {
  const provider = new Provider(issuer, {
    ...(adapter && { adapter }),
    // Nothing is signed with these keys today: the tokens are opaque, and
    // the `openid` scope is refused, so no ID token is issued (see
    // oauth.surface.test.js). They are required all the same, outside
    // development (config/dev-defaults.js): without them the provider signs
    // with its development keys, which are public, and they are what will
    // sign the day something is (JWT access tokens, ID tokens, signed
    // responses). Do not remove them. Changing them disconnects no assistant.
    ...(jwks && { jwks }),
    // Every fetch of the provider: client documents, on public hosts only.
    fetch: providerFetch({ fetch, lookup }),
    // The redirect URIs every client is kept to (mcp-client-metadata.js).
    extraClientMetadata: EXTRA_CLIENT_METADATA,
    scopes: SCOPES,
    responseTypes: ['code'],
    clientAuthMethods: CLIENT_AUTH_METHODS,
    pkce: { required: () => true },
    clientDefaults: {
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    },
    cookies: {
      keys: cookieKeys,
      long: { sameSite: 'lax' },
      short: { sameSite: 'lax' },
    },
    ttl: TTL,
    renderError,
    features: {
      devInteractions: { enabled: false },
      // An assistant only connects: it neither signs the user out nor reads
      // a profile.
      rpInitiatedLogout: { enabled: false },
      userinfo: { enabled: false },
      // An assistant sends its authorization request to the browser, never
      // ahead of it to the server.
      pushedAuthorizationRequests: { enabled: false },
      // /mcp takes a bearer token and checks no proof of possession: no
      // token is bound to a client's key.
      dPoP: { enabled: false },
      clientIdMetadataDocument: { enabled: true, ack: 'draft-02', allowFetch },
      // No registration access token: clients do not manage their
      // registration, and each token would be kept forever.
      registration: { enabled: true, issueRegistrationAccessToken: false },
      revocation: { enabled: true },
      resourceIndicators: {
        enabled: true,
        defaultResource: () => resource,
        useGrantedResource: () => true,
        getResourceServerInfo(ctx, requested) {
          if (requested !== resource) {
            throw new errors.InvalidTarget();
          }
          // The provider drops a scope it does not know; a client asking for
          // one is told, rather than connected with less than it expects.
          const unknown = String(ctx.oidc.params?.scope || '')
            .split(' ')
            .filter((scope) => scope && !SCOPES.includes(scope));
          if (unknown.length > 0) {
            throw new errors.InvalidScope(
              'requested scope is not offered',
              unknown.join(' ')
            );
          }
          return {
            audience: resource,
            scope: SCOPES.join(' '),
            accessTokenTTL: TTL.AccessToken,
            accessTokenFormat: 'opaque',
          };
        },
      },
    },
    interactions: {
      url: (ctx, interaction) => `/oauth/consent/${interaction.uid}`,
    },
    // Consent is asked every time: it is where the group is picked.
    loadExistingGrant(ctx) {
      const grantId = ctx.oidc.result?.consent?.grantId;
      return grantId ? ctx.oidc.provider.Grant.find(grantId) : undefined;
    },
    issueRefreshToken: (ctx, client) =>
      client.grantTypeAllowed('refresh_token'),
    // A connection lasts until it expires or is revoked (ADR 0012), never
    // as long as the authorization server's session of the browser it was
    // consented in: neither its code nor its tokens are bound to that
    // session, so a second consent in the same browser, or the session's end
    // after a day, leaves it whole.
    expiresWithSession: () => false,
    rotateRefreshToken: true,
    findAccount: (ctx, accountId) => ({
      accountId,
      claims: () => ({ sub: accountId }),
    }),
    discovery: {
      authorization_response_iss_parameter_supported: true,
    },
  });
  // The adapter keeps a client's secret as its digest: the server compares
  // what a client presents with it, whatever adapter it is given.
  compareClientSecretsByDigest(provider);
  // The provider keeps `openid` among its scopes, and announces ID tokens,
  // whatever it is given: the discovery says what this server grants, and
  // `openid` stays refused (getResourceServerInfo).
  provider.use(async (ctx, next) => {
    await next();
    if (ctx.path === DISCOVERY_PATH && ctx.body && ctx.status === 200) {
      ctx.body.scopes_supported = [...SCOPES];
      delete ctx.body.id_token_signing_alg_values_supported;
    }
  });
  attachAuthorizationServer(provider);
  // Why a token request was refused, never what it carried: a refresh token
  // used twice past the minute ends the connection, and the trace says so.
  provider.on('grant.error', (ctx, error) =>
    logger.warn(
      `[mcp-oauth] a token request was refused: ${
        error.error_detail || error.error_description || error.message
      }`
    )
  );
  provider.on('registration_create.success', (ctx, client) =>
    keepRegisteredClient(
      provider,
      client.clientId,
      REGISTRATION_TTL
    ).catch((error) => logger.error('[mcp-oauth] registration', error.message))
  );
  return provider;
}

module.exports = {
  createAuthorizationServer,
  oauthBodyParsers,
  jwksOf,
  keepRegisteredClient,
  accountIdOf,
  identityOf,
  SCOPES,
  TTL,
};
