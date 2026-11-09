'use strict';

const crypto = require('crypto');
const { McpClients, Groups } = require('../common/models.common.js');
const { isObjectIdString } = require('../utils/model.js');
const { revokeConnections } = require('./mcp-connections.js');
const { secretDigest } = require('./mcp-oauth-store.js');
const { isRedirectUri } = require('./mcp-client-metadata.js');

// The prefix of the ids given here, which `/mcp` checks are still listed.
const CLIENT_ID_PREFIX = 'lepatron-';
const AUTH_METHODS = ['client_secret_post', 'client_secret_basic'];
const MAX_NAME = 100;
const MAX_REDIRECT_URIS = 10;

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

// Whether a client id is one given here, to a client registered by hand.
const isRegisteredByHand = (clientId) =>
  String(clientId).startsWith(CLIENT_ID_PREFIX);

// What the authorization server reads of a client registered by hand.
const metadataOf = ({
  clientId,
  clientSecret,
  name,
  redirectUris,
  tokenEndpointAuthMethod,
  createdAt,
}) => ({
  client_id: clientId,
  client_secret: clientSecret,
  client_id_issued_at: Math.floor(new Date(createdAt).getTime() / 1000),
  client_name: name,
  redirect_uris: redirectUris,
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  token_endpoint_auth_method: tokenEndpointAuthMethod,
});

/**
 * The OAuth metadata of a client registered by hand, as the authorization
 * server reads it (mcp-oauth-adapter.js), its secret as its digest: the
 * company's settings are its only record.
 *
 * @param {string} clientId
 * @returns {Promise<Object|undefined>} undefined for a client not
 *   registered by hand, or deleted
 */
async function registeredClientMetadata(clientId) {
  if (!isRegisteredByHand(clientId)) return undefined;
  const client = await McpClients.findOne({ clientId })
    .select(
      'clientId name redirectUris tokenEndpointAuthMethod secretDigest createdAt'
    )
    .lean();
  return client
    ? metadataOf({ ...client, clientSecret: client.secretDigest })
    : undefined;
}

/**
 * Registers a client by hand for a company, as the authorization server
 * would take it, with its secret, answered this once and kept as its digest.
 *
 * @param {import('oidc-provider').default} provider what checks the client
 * @param {Object} registration
 * @param {Object} registration.fields as clientFieldsOf answers them
 * @param {string} registration.groupId the company
 * @param {string} registration.userId who registers it
 * @returns {Promise<{ client?: Object, clientSecret?: string, error?: string,
 *   code?: string }>} the client and its secret, or why it is refused
 */
async function registerClient(provider, { fields, groupId, userId }) {
  const clientId = `${CLIENT_ID_PREFIX}${crypto.randomUUID()}`;
  const clientSecret = crypto.randomBytes(48).toString('base64url');
  // What the authorization server would refuse when the client connects.
  try {
    await provider.Client.validate(
      metadataOf({ clientId, clientSecret, createdAt: new Date(), ...fields })
    );
  } catch (invalid) {
    return {
      error: invalid.error_description || invalid.message,
      code: 'invalid_client_metadata',
    };
  }
  const client = await McpClients.create({
    clientId,
    ...fields,
    secretDigest: secretDigest(clientSecret),
    _company: groupId,
    _createdBy: userId,
  });
  return { client, clientSecret };
}

/**
 * Deletes a company's client registered by hand: the authorization server
 * no longer knows it, and its connections are revoked.
 *
 * @param {Object} client
 * @param {string} client.clientId
 * @param {string} client.groupId the company it must belong to
 * @returns {Promise<boolean>} whether the company had it
 */
async function deleteClient({ clientId, groupId }) {
  const { deletedCount } = await McpClients.deleteOne({
    clientId,
    _company: groupId,
  });
  if (!deletedCount) return false;
  await revokeConnections({ clientId });
  return true;
}

/**
 * The company a client registered by hand belongs to, or null for a client
 * that registered itself or publishes its metadata document.
 *
 * @param {string} clientId
 * @returns {Promise<{id: string, name: string}|null>}
 */
async function companyOfClient(clientId) {
  if (!isRegisteredByHand(clientId)) return null;
  const client = await McpClients.findOne({ clientId })
    .select('_company')
    .lean();
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
  if (!isRegisteredByHand(clientId)) return true;
  if (!isObjectIdString(groupId)) return false;
  return !!(await McpClients.findOne({ clientId, _company: groupId })
    .select('_id')
    .lean());
}

/**
 * Forgets the clients a company registered when the company goes, their
 * secrets with them, and revokes their connections: nothing else would ever
 * delete them.
 *
 * @param {string|Object} groupId
 */
async function forgetCompanyClients(groupId) {
  const clientIds = await McpClients.distinct('clientId', {
    _company: groupId,
  });
  await McpClients.deleteMany({ _company: groupId });
  if (clientIds.length > 0) {
    await revokeConnections({ clientId: { $in: clientIds } });
  }
}

module.exports = {
  registerClient,
  deleteClient,
  registeredClientMetadata,
  isRegisteredByHand,
  CLIENT_ID_PREFIX,
  clientFieldsOf,
  isClientAllowed,
  companyOfClient,
  forgetCompanyClients,
};
