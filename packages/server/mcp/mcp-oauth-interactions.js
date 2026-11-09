'use strict';

const express = require('express');
const createError = require('http-errors');
const { Users, Groups } = require('../common/models.common.js');
const permissions = require('../account/permissions.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');
const { READ_SCOPE, WRITE_SCOPE, toRequestUser } = require('./mcp-identity.js');
const logger = require('../utils/logger.js');
const ERROR_CODES = require('../constant/error-codes.js');
const { accountIdOf, keepRegisteredClient, TTL } = require('./mcp-oauth.js');
const { recordConnection, revokeConnections } = require('./mcp-connections.js');
const { companyOfClient } = require('./mcp-clients.js');

// A refusal of the consent is an http-error whose message is its code
// (ERROR_CODES.MCP_CONSENT_…), which the app's error handler answers as it
// answers any route's: what the consent page translates.

// What a company lacks for its users to connect (ADR 0017): the MCP module,
// which only the platform company opens, or MCP access, which its tech admin
// turns on. None when it has both.
function lackOf(group) {
  if (group?.enableMcpModule !== true) return ERROR_CODES.MCP_CONSENT_NO_MODULE;
  if (group.enableMcp !== true) return ERROR_CODES.MCP_CONSENT_NO_ACCESS;
  return null;
}

const OPEN_FIELDS = 'enableMcpModule enableMcp';

// Why no company is offered, told from what is missing. Of the one company
// the consent is about: the client's, or the user's own. For a super admin
// free to choose, of them all: no company has the module, or none has MCP
// access as well.
async function refusalWithoutGroups(consenter, company) {
  const companyId = company?.id || (!consenter.isPlatform && consenter.ownId);
  if (!companyId) {
    return (await Groups.exists({ enableMcpModule: true }))
      ? ERROR_CODES.MCP_CONSENT_NO_ACCESS
      : ERROR_CODES.MCP_CONSENT_NO_MODULE;
  }
  const group = await Groups.findById(companyId).select(OPEN_FIELDS).lean();
  return lackOf(group) || ERROR_CODES.MCP_CONSENT_NO_ACCESS;
}

// The account behind the app's session, read as the MCP server reads it, and
// the groups a connection may be bound to: the user's own, or, for a super
// admin, every group with MCP access. Either way, only a group that has the
// MCP module (ADR 0017).
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
  const open = { enableMcpModule: true, enableMcp: true };
  const groups = await Groups.find(
    isPlatform ? open : { _id: record._company, ...open }
  )
    .select('_id name')
    .sort({ name: 1 })
    .lean();
  return {
    user,
    isPlatform,
    ownId: String(record._company),
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

  // The interaction this browser started, still waiting for its answer: a
  // consent link opened in another browser answers nothing, and a consent
  // takes one answer, the first.
  const startedHere = async (req, res, next) => {
    try {
      const interaction = await provider
        .interactionDetails(req, res)
        .catch(() => null);
      if (
        !interaction ||
        interaction.uid !== req.params.uid ||
        interaction.result
      ) {
        return next(createError(404, ERROR_CODES.MCP_CONSENT_EXPIRED));
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
      : next(createError(401, ERROR_CODES.MCP_CONSENT_SIGN_IN_REQUIRED));

  // The consenting user. The bootstrap account, which has no document,
  // connects nothing.
  const consenting = async (req, res, next) => {
    try {
      req.consenter = await consenterOf(req);
      if (!req.consenter) {
        return next(
          createError(403, ERROR_CODES.MCP_CONSENT_ACCOUNT_CANNOT_CONNECT)
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
          return next(
            createError(403, ERROR_CODES.MCP_CONSENT_CLIENT_OF_ANOTHER_COMPANY)
          );
        }
        consenter.groups = consenter.groups.filter(
          (group) => group.id === company.id
        );
      }
      // A user offered no company is told what it lacks: the module, which
      // only the platform company opens, or MCP access, which its tech admin
      // turns on.
      if (consenter.groups.length === 0) {
        return next(
          createError(403, await refusalWithoutGroups(consenter, company))
        );
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
      res.json({
        client: {
          name: client?.clientName || params.client_id,
          ...registrationOf(params.client_id, req.clientCompany),
        },
        // Where the answer goes, for the user to recognise the application
        // (the MCP specification asks the consent to show it). Every redirect
        // URI has a host (mcp-client-metadata.js).
        redirectHost: new URL(params.redirect_uri).host,
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
        return next(createError(403, ERROR_CODES.MCP_CONSENT_NO_ACCESS));
      }
      if (!granted.includes(READ_SCOPE)) {
        return next(
          createError(400, ERROR_CODES.MCP_CONSENT_READ_SCOPE_REQUIRED)
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
      // (Claude Code, VS Code) keeps its own. Past ten (recordConnection), the
      // oldest of the user's connections of that application to that company
      // goes.
      await recordConnection({
        grantId,
        clientId: interaction.params.client_id,
        clientName: client?.clientName || interaction.params.client_id,
        userId: consenter.user.id,
        groupId,
        ttl: TTL.Grant,
      });
      // The module closed, or MCP access turned off, while the user
      // consented: the closing revoked the connections it found, which this
      // one may have been recorded after. Read again now it is recorded, so
      // it goes as the others did, and a reopened module revives none.
      const lack = lackOf(
        await Groups.findById(groupId).select(OPEN_FIELDS).lean()
      );
      if (lack) {
        await revokeConnections({ grantId });
        return next(createError(403, lack));
      }
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
