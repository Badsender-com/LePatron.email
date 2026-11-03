'use strict';

const express = require('express');
const { Users, Groups } = require('../common/models.common.js');
const permissions = require('../account/permissions.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');
const { READ_SCOPE } = require('./mcp-identity.js');
const { WRITE_SCOPE } = require('./mcp-authoring.js');
const { accountIdOf } = require('./mcp-oauth.js');

const NO_ACCESS = 'This group has no MCP access to LePatron.';

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
      res.json({
        client: { name: client?.clientName || params.client_id },
        // Where the answer goes, for the user to recognise the application.
        redirectHost: new URL(params.redirect_uri).host,
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
      return finish(req, res, {
        login: { accountId },
        consent: { grantId },
      });
    } catch (err) {
      return next(err);
    }
  });

  router.post('/:uid/deny', async (req, res, next) => {
    try {
      return finish(req, res, {
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
