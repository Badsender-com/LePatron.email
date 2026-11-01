'use strict';

// ESM only: Node 24 lets the app require it (ADR 0012).
const { default: Provider, errors } = require('oidc-provider');
const { McpClients } = require('../common/models.common.js');
const logger = require('../utils/logger.js');
const { SCOPES } = require('./mcp-identity.js');

// Short-lived access tokens, rotating refresh tokens (ADR 0012).
const TTL = {
  AccessToken: 3600,
  AuthorizationCode: 60,
  // The time to log in and consent: a consent link is worth little after.
  Interaction: 600,
  Session: 24 * 3600,
  Grant: 90 * 24 * 3600,
  RefreshToken: 30 * 24 * 3600,
  // A client that registered (DCR) and connected nobody since.
  Registration: 24 * 3600,
};

// A client proves itself with its secret, or, public, with PKCE alone.
const CLIENT_AUTH_METHODS = [
  'none',
  'client_secret_post',
  'client_secret_basic',
];

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
 * A client a super admin registered stays until deleted; a client known by
 * its metadata document is not stored.
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
 * @param {Object} [options.jwks] the signing keys; generated when not given
 * @param {Function} [options.fetch] what fetches a client's metadata document
 * @returns {Provider}
 */
function createAuthorizationServer({
  issuer,
  resource,
  cookieKeys,
  adapter,
  jwks,
  fetch,
}) {
  const provider = new Provider(issuer, {
    ...(adapter && { adapter }),
    ...(jwks && { jwks }),
    ...(fetch && { fetch }),
    scopes: SCOPES,
    claims: { openid: ['sub'] },
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
    features: {
      devInteractions: { enabled: false },
      clientIdMetadataDocument: { enabled: true, ack: 'draft-02' },
      registration: { enabled: true },
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
    rotateRefreshToken: true,
    findAccount: (ctx, accountId) => ({
      accountId,
      claims: () => ({ sub: accountId }),
    }),
    discovery: {
      authorization_response_iss_parameter_supported: true,
    },
  });
  provider.on('registration_create.success', (ctx, client) =>
    keepRegisteredClient(
      provider,
      client.clientId,
      TTL.Registration
    ).catch((error) => logger.error('[mcp-oauth] registration', error.message))
  );
  return provider;
}

module.exports = {
  createAuthorizationServer,
  keepRegisteredClient,
  accountIdOf,
  identityOf,
  SCOPES,
};
