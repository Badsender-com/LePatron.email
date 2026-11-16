'use strict';

const logger = require('../utils/logger.js');

// A detail of the provider may quote what a request carried (its Origin
// header, its scopes): logged on one line, and cut short.
const MAX_LOGGED = 200;

function bounded(value) {
  return String(value ?? 'none')
    .replace(/\p{Cc}+/gu, ' ')
    .slice(0, MAX_LOGGED);
}

/**
 * Logs what the authorization server refuses and the connections it ends
 * itself (ADR 0012), by the client and the grant they are of: never what a
 * request sent, never a token.
 *
 * @param {import('oidc-provider').default} provider
 */
function logAuthorizationServer(provider) {
  provider.on('grant.error', (ctx, error) => {
    const entities = ctx.oidc?.entities ?? {};
    const grantId =
      entities.RefreshToken?.grantId ?? entities.AuthorizationCode?.grantId;
    logger.warn(
      `[mcp-oauth] a token request was refused: ${bounded(
        error.error_detail || error.error_description || error.message
      )} (client ${bounded(ctx.oidc?.client?.clientId)}, grant ${bounded(
        grantId
      )})`
    );
  });
  // A refresh token used past its 30 seconds, or a client revoking its own:
  // the connection goes with the grant (mcp-connections.js).
  provider.on('grant.revoked', (ctx, grantId) =>
    logger.warn(
      `[mcp-oauth] the authorization server ended a connection (client ${bounded(
        ctx.oidc?.client?.clientId
      )}, grant ${bounded(grantId)})`
    )
  );
}

module.exports = { logAuthorizationServer };
