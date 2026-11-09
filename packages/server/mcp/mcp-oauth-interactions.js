'use strict';

const express = require('express');
const { Users, Groups } = require('../common/models.common.js');
const permissions = require('../account/permissions.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');
const { READ_SCOPE, WRITE_SCOPE, toRequestUser } = require('./mcp-identity.js');
const logger = require('../utils/logger.js');
const ERROR_CODES = require('../constant/error-codes.js');
const { accountIdOf, keepRegisteredClient, TTL } = require('./mcp-oauth.js');
const { recordConnection } = require('./mcp-connections.js');
const { companyOfClient } = require('./mcp-clients.js');

const NO_ACCESS = 'This company has no MCP access to LePatron.';
// The connections a user keeps of one application to one company.
const CONNECTIONS_PER_CLIENT = 10;

// `code`, one of ERROR_CODES.MCP_CONSENT_…, is what the consent page
// translates.
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
  // No company is chosen yet: the user's own stands for it.
  const user = toRequestUser(record, record._company);
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
 * How the client made itself known, for the user to weigh its name: a
 * company registered it (its name is shown), a site publishes its metadata
 * document (its host is shown), or it registered itself, and its name is only
 * what it claims.
 */
function registrationOf(clientId, company) {
  if (company) {
    return { registration: 'preRegistered', company: company.name };
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

  // The interaction this browser started: a consent link opened in another
  // browser answers nothing.
  const startedHere = async (req, res, next) => {
    try {
      const interaction = await provider
        .interactionDetails(req, res)
        .catch(() => null);
      if (!interaction || interaction.uid !== req.params.uid) {
        return refuse(
          res,
          404,
          'This connection request has expired, or was started in another browser.',
          ERROR_CODES.MCP_CONSENT_EXPIRED
        );
      }
      req.interaction = interaction;
      return next();
    } catch (err) {
      return next(err);
    }
  };

  const signedIn = (req, res, next) =>
    req.user
      ? next()
      : refuse(
          res,
          401,
          'Log in to LePatron first.',
          ERROR_CODES.MCP_CONSENT_SIGN_IN_REQUIRED
        );

  // The consenting user. The bootstrap account, which has no document,
  // connects nothing.
  const consenting = async (req, res, next) => {
    try {
      req.consenter = await consenterOf(req);
      if (!req.consenter) {
        return refuse(
          res,
          403,
          'This account cannot connect an assistant.',
          ERROR_CODES.MCP_CONSENT_ACCOUNT_CANNOT_CONNECT
        );
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };

  // What may be granted to the user. Checked in the order that tells them
  // why they cannot connect: the company of a client registered by hand,
  // then the MCP access.
  const mayConnect = async (req, res, next) => {
    try {
      const { consenter } = req;
      // A client a company registered connects that company alone.
      const company = await companyOfClient(req.interaction.params.client_id);
      if (company) {
        if (!permissions.canAccessGroup(consenter.user, company.id)) {
          return refuse(
            res,
            403,
            'This application belongs to another company.',
            ERROR_CODES.MCP_CONSENT_CLIENT_OF_ANOTHER_COMPANY
          );
        }
        consenter.groups = consenter.groups.filter(
          (group) => group.id === company.id
        );
      }
      if (consenter.groups.length === 0) {
        return refuse(res, 403, NO_ACCESS, ERROR_CODES.MCP_CONSENT_NO_ACCESS);
      }
      req.clientCompany = company;
      // What the user may grant, whatever the application asked for: the
      // clients only know of the read scope the server advertises, and the
      // consent offers drafting to whoever may manage the platform (ADR 0014).
      req.granted = consenter.scopes;
      return next();
    } catch (err) {
      return next(err);
    }
  };

  // Seeing and giving the consent need a user who may give it.
  router.use(
    ['/:uid/details', '/:uid/consent'],
    signedIn,
    consenting,
    startedHere,
    mayConnect
  );

  router.get('/:uid/details', async (req, res, next) => {
    try {
      const { params } = req.interaction;
      const client = await provider.Client.find(params.client_id);
      const redirect = new URL(params.redirect_uri);
      res.json({
        client: {
          name: client?.clientName || params.client_id,
          ...registrationOf(params.client_id, req.clientCompany),
        },
        // Where the answer goes, for the user to recognise the application;
        // the whole URI when it has no host (an app's own scheme).
        redirectHost: redirect.host || params.redirect_uri,
        scopes: req.granted,
        groups: req.consenter.groups,
        // Whose rights the application gets, for the user to check.
        account: {
          name: req.consenter.user.name,
          email: req.consenter.user.email,
        },
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
      const { interaction, consenter } = req;
      // Drafting is offered, never assumed (ADR 0014): granted only when the
      // user ticks it, whatever the application asked for.
      const granted = req.granted.filter(
        (scope) => scope !== WRITE_SCOPE || req.body?.allowWrite === true
      );
      const groupId = String(req.body?.groupId || '');
      if (!consenter.groups.some((group) => group.id === groupId)) {
        return refuse(res, 403, NO_ACCESS, ERROR_CODES.MCP_CONSENT_NO_ACCESS);
      }
      if (!granted.includes(READ_SCOPE)) {
        return refuse(
          res,
          400,
          `The ${READ_SCOPE} scope is required.`,
          ERROR_CODES.MCP_CONSENT_READ_SCOPE_REQUIRED
        );
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
      // The token carries what was granted: the provider resumes the
      // authorization with the parameters the interaction keeps.
      interaction.params.scope = granted.join(' ');
      await interaction.save(
        Math.max(interaction.exp - Math.floor(Date.now() / 1000), 1)
      );
      const client = await provider.Client.find(interaction.params.client_id);
      // One connection per consent: the same application on another machine
      // (Claude Code, VS Code) keeps its own. Past a cap, the oldest of the
      // user's connections of that application to that company goes.
      await recordConnection({
        grantId,
        clientId: interaction.params.client_id,
        clientName: client?.clientName || interaction.params.client_id,
        userId: consenter.user.id,
        groupId,
        ttl: TTL.Grant,
        cap: CONNECTIONS_PER_CLIENT,
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

  // Declining needs nothing but the interaction: whoever cannot connect may
  // still send the application its answer.
  router.post('/:uid/deny', startedHere, async (req, res, next) => {
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
