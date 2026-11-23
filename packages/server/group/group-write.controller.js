'use strict';

// The company's creation and update: each field through the rule it answers
// to, the switches through group-switch.js.

const { pick } = require('lodash');
const asyncHandler = require('express-async-handler');
const { createWorkspace } = require('../workspace/workspace.service.js');

const groupService = require('../group/group.service.js');
const permissions = require('../account/permissions.js');
const {
  takeSwitches,
  writeSwitches,
  recordSwitches,
  forgetSwitchedOff,
} = require('./group-switch.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');
const groupFtpService = require('../group/group-ftp.service.js');
const { restampLogs } = require('./log-retention.js');
const { forgetRetention } = require('../mcp/mcp-call-log.js');
const taxonomyDefaultsService = require('../taxonomy/taxonomy-defaults.service.js');
const { pickSeedLang } = require('../taxonomy/default-email-types.js');
const logger = require('../utils/logger.js');
const { normalizeIdpCert } = require('../account/saml-config.js');
const { Groups } = require('../common/models.common.js');
const {
  sanitizeTrackingConfig,
} = require('../utils/resolve-tracking-config.js');
const {
  sanitizeEmailMetadata,
} = require('../utils/sanitize-email-metadata.js');

module.exports = {
  create: asyncHandler(create),
  update: asyncHandler(update),
};

/**
 * The company fields a request names: its own keys, but those that start
 * with `$`, which the database would read as an update operator rather than
 * a field. A company is written by its named fields only, each one through
 * the rule it answers to (the switches through group-switch.js).
 *
 * @param {Object} body the request body
 * @returns {Object} a copy, with the named fields only
 */
function namedFieldsOf(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  return Object.fromEntries(
    Object.entries(body).filter(([key]) => !key.startsWith('$'))
  );
}

/**
 * @api {post} /groups group creation
 * @apiPermission admin
 * @apiName CreateGroup
 * @apiGroup Groups
 *
 * @apiParam (Body) {String} name
 * @apiParam (Body) {Boolean} downloadMailingWithoutEnclosingFolder if we want to zip with an enclosing folder
 * @apiParam (Body) {Boolean} downloadMailingWithCdnImages if the images path of the downloaded archive should point to a CDN
 * @apiParam (Body) {String} [cdnProtocol] the protocol of the CDN
 * @apiParam (Body) {String} [cdnEndPoint] the CDN endpoint
 * @apiParam (Body) {String} [cdnButtonLabel] what will be the label of the `download CDN` button on the interface
 * @apiParam (Body) {Boolean} [downloadMailingWithFtpImages] if the images path of the downloaded archive should point to a FTP
 * @apiParam (Body) {String} [ftpProtocol] the FTP protocol, only sftp is currently supported (default: sftp)
 * @apiParam (Body) {String} [ftpHost] the FTP host
 * @apiParam (Body) {String} [ftpUsername] the FTP username
 * @apiParam (Body) {String} [ftpPassword] the FTP password
 * @apiParam (Body) {Number} [ftpPort] the FTP port (default: 22)
 * @apiParam (Body) {String} [ftpEndPoint] the FTP endpoint url to retrieve images
 * @apiParam (Body) {String} [ftpEndPointProcotol] the FTP endpoint protocol
 * @apiParam (Body) {String} [ftpPathOnServer] the FTP path folder where we will save images
 *
 * @apiUse group
 */

async function create(req, res) {
  // Validate SSH key format if provided
  if (req.body.ftpSshKey) {
    groupFtpService.validateSshKeyOrThrow(req.body.ftpSshKey);
  }

  // Not a company field: the language the default email types are seeded in.
  const { defaultEmailTypesLang, ...groupToCreate } = namedFieldsOf(req.body);
  // A company starts with its switches off: they are turned on from its
  // settings, where each one is recorded as a security event. The MCP module
  // alone may be opened at creation, as the other modules, by the super admin
  // who creates the company (ADR 0017): recorded as its opening.
  const { enableMcpModule } = takeSwitches(groupToCreate);
  if (enableMcpModule) groupToCreate.enableMcpModule = true;

  if ('idpCert' in groupToCreate) {
    groupToCreate.idpCert = normalizeIdpCert(groupToCreate.idpCert);
  }

  // The update path is not the only write path: without this, a company could be
  // created with a shape the update path would have refused.
  if ('emailMetadata' in groupToCreate) {
    groupToCreate.emailMetadata = sanitizeEmailMetadata(
      groupToCreate.emailMetadata
    );
  }

  const defaultWorkspaceName = req.body.defaultWorkspaceName || 'Workspace';
  const newGroup = await groupService.createGroup(groupToCreate);
  await recordSwitches(
    req.user,
    newGroup.id,
    enableMcpModule ? { enableMcpModule } : {}
  );
  const workspaceParams = { name: defaultWorkspaceName, groupId: newGroup.id };
  await createWorkspace(workspaceParams);

  // The six Badsender email types, in the language the creator's screen is
  // displayed in. Only a super admin creates a company, and their session carries
  // no `lang`: without the one the client sends, every company started in English.
  // A failure here must not fail the creation: the company exists, and an admin —
  // or scripts/seed-default-email-types.js — adds the types afterwards. Losing a
  // company over its default vocabulary would be the worse trade.
  try {
    await taxonomyDefaultsService.seedDefaultEmailTypes({
      companyId: newGroup._id,
      lang: pickSeedLang(defaultEmailTypesLang, req.user?.lang),
    });
  } catch (error) {
    logger.error(
      `group.controller:create: seeding default email types failed for company ${newGroup.id}`,
      error
    );
  }

  res.json(groupFtpService.maskFtpCredentials(newGroup));
}

/**
 * @api {put} /groups/:groupId group update
 * @apiPermission admin
 * @apiName UpdateGroup
 * @apiGroup Groups
 *
 * @apiParam {string} groupId
 * @apiParam (Body) {String} name
 * @apiParam (Body) {Boolean} downloadMailingWithoutEnclosingFolder if we want to zip with an enclosing folder
 * @apiParam (Body) {Boolean} downloadMailingWithCdnImages if the images path of the downloaded archive should point to a CDN
 * @apiParam (Body) {String} [cdnProtocol] the protocol of the CDN
 * @apiParam (Body) {String} [cdnEndPoint] the CDN endpoint
 * @apiParam (Body) {String} [cdnButtonLabel] what will be the label of the `download CDN` button on the interface
 * @apiParam (Body) {Boolean} [downloadMailingWithFtpImages] if the images path of the downloaded archive should point to a FTP
 * @apiParam (Body) {String} [ftpProtocol] the FTP protocol, only sftp is currently supported (default: sftp)
 * @apiParam (Body) {String} [ftpHost] the FTP host
 * @apiParam (Body) {String} [ftpUsername] the FTP username
 * @apiParam (Body) {String} [ftpPassword] the FTP password
 * @apiParam (Body) {Number} [ftpPort] the FTP port (default: 22)
 * @apiParam (Body) {String} [ftpEndPoint] the FTP endpoint url to retrieve images
 * @apiParam (Body) {String} [ftpEndPointProcotol] the FTP endpoint protocol
 * @apiParam (Body) {String} [ftpPathOnServer] the FTP path folder where we will save images
 *
 * @apiUse group
 */

async function update(req, res) {
  const { user } = req;

  // Process credentials (handle masking and deletion)
  const processedBody = groupFtpService.processCredentialsForUpdate(
    namedFieldsOf(req.body)
  );
  // The platform flag has its own endpoint and its own guardrail (ADR 0002).
  delete processedBody.isPlatform;

  // Validate SSH key format if provided and not masked
  if (processedBody.ftpSshKey) {
    groupFtpService.validateSshKeyOrThrow(processedBody.ftpSshKey);
  }

  // The `id` comes last on purpose: the group being updated is the one named by
  // the URL — the only value the route guard checked — so a payload carrying its
  // own `id` cannot redirect the write elsewhere.
  let groupToUpdate = {
    ...processedBody,
    id: req.params.groupId,
  };

  // Validate/normalize the tracking config shape before persisting (the UI
  // guards are bypassable). Only when the payload actually carries it.
  if (groupToUpdate.trackingConfig != null) {
    groupToUpdate.trackingConfig = sanitizeTrackingConfig(
      groupToUpdate.trackingConfig
    );
  }

  // Same reasoning as trackingConfig: shape guaranteed server-side, and only
  // when the payload actually carries it (partial updates are the norm here).
  // `in` rather than `!= null`, so an explicit null goes through the sanitizer
  // and yields the default sub-object instead of being stored as null.
  // The stored config is read first, and only when the payload carries the key,
  // following the `previousRetention` pattern below: the sanitizer returns the
  // whole sub-object, so without it a partial update would resolve the missing
  // keys to their defaults and switch the feature off for the company.
  if ('emailMetadata' in groupToUpdate) {
    const storedMetadata = (
      await Groups.findById(req.params.groupId, { emailMetadata: 1 }).lean()
    )?.emailMetadata;
    groupToUpdate.emailMetadata = sanitizeEmailMetadata(
      groupToUpdate.emailMetadata,
      storedMetadata
    );
  }

  // Only reachable by a super admin: the pick below drops it for a company admin.
  if ('idpCert' in groupToUpdate) {
    groupToUpdate.idpCert = normalizeIdpCert(groupToUpdate.idpCert);
  }

  // Anyone but a super admin: the route lets a company admin of the group
  // through, and no one else.
  if (!permissions.can(user, CAPABILITIES.PLATFORM_MANAGE)) {
    groupToUpdate = pick(groupToUpdate, [
      'name',
      'colorScheme',
      // Without this, a company admin cannot configure the email metadata
      // feature at all — the field would be silently dropped here.
      'emailMetadata',
      // The company's tracking belongs to its technical settings (ADR 0004),
      // and so does two-factor authentication for every member (ADR 0008):
      // dropped for a company admin, as the other fields it cannot set.
      // MCP access too: a tech admin connects the company's AI assistants
      // to LePatron, as it sets up its AI features, and decides whether their
      // session summaries may reach the platform company (ADR 0012).
      ...(permissions.can(user, CAPABILITIES.GROUP_MANAGE_TECH)
        ? ['trackingConfig', 'requireTwoFactor', 'enableMcp', 'allowRetex']
        : []),
    ]);
    // Reinstated after the pick, from the URL, so the whitelist never has to
    // carry the id of the target.
    groupToUpdate.id = req.params.groupId;
  }

  // Read the retention before the write, and only when the payload carries it,
  // so an ordinary group update costs no extra query.
  const carriesRetention = groupToUpdate.logRetentionDays !== undefined;
  const previousRetention = carriesRetention
    ? (
        await Groups.findById(req.params.groupId, {
          logRetentionDays: 1,
        }).lean()
      )?.logRetentionDays
    : undefined;

  // The company's switches are written apart, after the rest, in the one
  // operation that tells what they were: a security event is recorded for a
  // switch this request changed, and for it only.
  const switches = takeSwitches(groupToUpdate);
  await groupService.updateGroup(groupToUpdate);
  const switched = await writeSwitches(req.params.groupId, switches);
  await recordSwitches(user, req.params.groupId, switched);
  await forgetSwitchedOff(req.params.groupId, switches);

  // A log's end of retention is stamped at write time, so a retention change
  // has to reach the logs already kept: lowering it would otherwise apply to
  // future ones only, and the RGPD promise would be weaker than the nightly
  // purge this replaced. Done after the answer, which does not wait for it.
  const nextRetention = Number(groupToUpdate.logRetentionDays);
  if (carriesRetention && nextRetention !== previousRetention) {
    // The MCP call logs written from now on take the new retention at once.
    forgetRetention(req.params.groupId);
    restampLogs(req.params.groupId).catch((error) =>
      logger.error(
        `[group] the logs of group=${req.params.groupId} did not take the new retention`,
        error
      )
    );
  }

  // Fetch the updated group to return with masked credentials
  const updatedGroup = await Groups.findById(req.params.groupId);
  res.json(groupFtpService.maskFtpCredentials(updatedGroup));
}
