'use strict';

const express = require('express');
const { Users, Groups, McpClients } = require('../common/models.common.js');
const permissions = require('../account/permissions.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');
const { READ_SCOPE, WRITE_SCOPE } = require('./mcp-identity.js');
const logger = require('../utils/logger.js');
const { accountIdOf, keepRegisteredClient, TTL } = require('./mcp-oauth.js');
const { recordConnection, revokeConnections } = require('./mcp-connections.js');

const NO_ACCESS = 'This company has no MCP access to LePatron.';

// `code` is what the consent page translates.
const refuse = (res, status, message, code) =>
  res.status(status).json({ message, ...(code && { code }) });

// The account behind the app's session, read as the MCP server reads it, and
// the groups a connection may be bound to: the user's own, or, for a super
// admin, every group with MCP access.
async function consenterOf(req) {
  const userId = req.user?.id;
  const record =
    userId &&
    (await Users.findOne({ _id: userId, isDeactivated: { $ne: true } })
      .select('_id name email role _company')
      .lean());
  if (!record) return null;
  const user = permissions.withCapabilities({
    ...record,
    id: String(record._id),
    group: { id: String(record._company) },
  });
  const isPlatform = permissions.can(user, CAPABILITIES.PLATFORM_MANAGE);
  const groups = await Groups.find(
    isPlatform ? { enableMcp: true } : { _id: record._company, enableMcp: true }
  )
    .select('_id name')
    .sort({ name: 1 })
    .lean();
  return {
    user,
    groups: groups.map((group) => ({
      id: String(group._id),
      name: group.name,
    })),
    // Drafting skills and expertises is offered to whoever may manage the
    // platform (ADR 0014).
    scopes: isPlatform ? [READ_SCOPE, WRITE_SCOPE] : [READ_SCOPE],
  };
}

/**
 * How the client made itself known, for the user to weigh its name: a super
 * admin registered it, a site publishes its metadata document (its host is
 * shown), or it registered itself, and its name is only what it claims.
 */
async function registrationOf(clientId) {
  if (await McpClients.findOne({ clientId }).lean()) {
    return { registration: 'preRegistered' };
  }
  try {
    const url = new URL(clientId);
    if (url.protocol === 'https:') {
      return { registration: 'metadataDocument', host: url.host };
    }
  } catch {
    // Not a URL: an id the authorization server gave.
  }
  return { registration: 'dynamic' };
}

/**
 * The consent of a connection (ADR 0012), read and answered by the consent
 * page with the app's session. Served under the consent page's own path,
 * `/oauth/consent/:uid/…`, where the provider's interaction cookie is sent:
 * the provider checks that the browser answering is the one that started the
 * authorization, so a consent link sent to someone else answers nothing.
 *
 * @param {import('oidc-provider').default} provider
 * @param {string} resource the MCP endpoint's URL
 * @returns {express.Router}
 */
function createInteractionsRouter(provider, resource) {
  const router = express.Router();

  // The consenting user, the interaction this browser started, and what may
  // be granted to the user.
  router.param('uid', async (req, res, next, uid) => {
    try {
      if (!req.user) return refuse(res, 401, 'Log in to LePatron first.');
      const consenter = await consenterOf(req);
      // The bootstrap account, which has no document, connects nothing.
      if (!consenter) {
        return refuse(
          res,
          403,
          'This account cannot connect an assistant.',
          'account_cannot_connect'
        );
      }
      if (consenter.groups.length === 0) {
        return refuse(res, 403, NO_ACCESS, 'no_mcp_access');
      }
      const interaction = await provider
        .interactionDetails(req, res)
        .catch(() => null);
      if (!interaction || interaction.uid !== uid) {
        return refuse(
          res,
          404,
          'This connection request has expired, or was started in another browser.',
          'expired'
        );
      }
      const requested = String(interaction.params.scope || '').split(' ');
      req.interaction = interaction;
      req.consenter = consenter;
      req.granted = consenter.scopes.filter((scope) =>
        requested.includes(scope)
      );
      return next();
    } catch (err) {
      return next(err);
    }
  });

  router.get('/:uid/details', async (req, res, next) => {
    try {
      const { params } = req.interaction;
      const client = await provider.Client.find(params.client_id);
      const redirect = new URL(params.redirect_uri);
      res.json({
        client: {
          name: client?.clientName || params.client_id,
          ...(await registrationOf(params.client_id)),
        },
        // Where the answer goes, for the user to recognise the application;
        // the whole URI when it has no host (an app's own scheme).
        redirectHost: redirect.host || params.redirect_uri,
        scopes: req.granted,
        groups: req.consenter.groups,
        // Whose rights the application gets, for the user to check.
        account: { email: req.consenter.user.email },
      });
    } catch (err) {
      next(err);
    }
  });

  const finish = async (req, res, result) => {
    const redirectTo = await provider.interactionResult(req, res, result, {
      mergeWithLastSubmission: false,
    });
    res.json({ redirectTo });
  };

  router.post('/:uid/consent', async (req, res, next) => {
    try {
      const { interaction, consenter, granted } = req;
      const groupId = String(req.body?.groupId || '');
      if (!consenter.groups.some((group) => group.id === groupId)) {
        return refuse(res, 403, NO_ACCESS, 'no_mcp_access');
      }
      if (!granted.includes(READ_SCOPE)) {
        return refuse(res, 400, `The ${READ_SCOPE} scope is required.`);
      }
      const accountId = accountIdOf(consenter.user.id, groupId);
      const grant = new provider.Grant({
        accountId,
        clientId: interaction.params.client_id,
      });
      // The provider checks the scopes requested on the authorization request
      // as its own, and the token's as the resource's.
      grant.addOIDCScope(granted.join(' '));
      grant.addResourceScope(resource, granted.join(' '));
      const grantId = await grant.save();
      const client = await provider.Client.find(interaction.params.client_id);
      // Connecting an application again replaces its previous connection to
      // the group: one line per application, and no older token lives on.
      await revokeConnections(provider, {
        _user: consenter.user.id,
        _company: groupId,
        clientId: interaction.params.client_id,
      });
      await recordConnection({
        grantId,
        clientId: interaction.params.client_id,
        clientName: client?.clientName || interaction.params.client_id,
        userId: consenter.user.id,
        groupId,
        ttl: TTL.Grant,
      });
      // Never in the way of the consent: the client only lives on.
      await keepRegisteredClient(
        provider,
        interaction.params.client_id
      ).catch((error) =>
        logger.error('[mcp-oauth] keep client', error.message)
      );
      return await finish(req, res, {
        login: { accountId },
        consent: { grantId },
      });
    } catch (err) {
      return next(err);
    }
  });

  router.post('/:uid/deny', async (req, res, next) => {
    try {
      return await finish(req, res, {
        error: 'access_denied',
        error_description: 'The user declined the connection.',
      });
    } catch (err) {
      return next(err);
    }
  });

  return router;
}

module.exports = { createInteractionsRouter };
