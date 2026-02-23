'use strict';

const { pick } = require('lodash');
const { NotFound } = require('http-errors');
const asyncHandler = require('express-async-handler');
const {
  createWorkspace,
  findWorkspaces,
} = require('../workspace/workspace.service.js');

const groupService = require('../group/group.service.js');
const profileService = require('../profile/profile.service.js');
const emailsGroupService = require('../emails-group/emails-group.service.js');
const personalizedVariableService = require('../personalized-variables/personalized-variable.service.js');
const groupFtpService = require('../group/group-ftp.service.js');

const { Groups, Templates, Mailings } = require('../common/models.common.js');

module.exports = {
  list: asyncHandler(list),
  seedGroups: asyncHandler(seedGroups),
  create: asyncHandler(create),
  read: asyncHandler(read),
  readUsers: asyncHandler(readUsers),
  readTemplates: asyncHandler(readTemplates),
  readMailings: asyncHandler(readMailings),
  readProfiles: asyncHandler(readProfiles),
  readWorkspaces: asyncHandler(readWorkspaces),
  readEmailGroups: asyncHandler(readEmailGroups),
  readColorScheme: asyncHandler(readColorScheme),
  update: asyncHandler(update),
  deleteGroup: asyncHandler(deleteGroup),
  readPersonalizedVariables: asyncHandler(readPersonalizedVariables),
  createOrUpdatePersonalizedVariables: asyncHandler(
    createOrUpdatePersonalizedVariables
  ),
  deletePersonalizedVariable: asyncHandler(deletePersonalizedVariable),
  testFtpConnection: asyncHandler(testFtpConnection),
};

/**
 * @api {get} /groups list of groups
 * @apiPermission admin
 * @apiName GetGroups
 * @apiGroup Groups
 *
 * @apiUse group
 * @apiSuccess {group[]} items list of groups
 */

async function list(req, res) {
  const groups = await Groups.find({}).sort({ name: 1 });
  res.json({ items: groups });
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

  const defaultWorkspaceName = req.body.defaultWorkspaceName || 'Workspace';
  const newGroup = await groupService.createGroup(req.body);
  const workspaceParams = { name: defaultWorkspaceName, groupId: newGroup.id };
  await createWorkspace(workspaceParams);
  res.json(groupFtpService.maskFtpCredentials(newGroup));
}

/**
 * @api {post} /seed-groups update groups that have no workspace
 * @apiPermission super_admin
 * @apiName UpdateGroupsWithNoWorkspaces
 * @apiGroup Groups
 *
 * @apiUse group
 */

async function seedGroups(req, res) {
  const seededGroups = await groupService.seedGroups();

  res.json({ groups: seededGroups.map((group) => group.name) });
}

/**
 * @api {get} /groups/:groupId group
 * @apiPermission admin
 * @apiName GetGroup
 * @apiGroup Groups
 *
 * @apiParam {string} groupId
 *
 * @apiUse group
 */

async function read(req, res) {
  const { groupId } = req.params;
  const group = await Groups.findById(groupId);
  if (!group) throw new NotFound();
  res.json(groupFtpService.maskFtpCredentials(group));
}

/**
 * @api {get} /groups/:groupId detele group
 * @apiPermission admin
 * @apiName GetGroup
 * @apiGroup Groups
 *
 * @apiParam {string} groupId
 *
 * @apiUse group
 */

async function deleteGroup(req, res) {
  const {
    params: { groupId },
    user,
  } = req;
  const group = await Groups.findById(groupId);
  if (!group) throw new NotFound();

  if (!user.isAdmin) {
    throw new NotFound();
  }
  await groupService.deleteGroup(groupId);

  res.json(group);
}

/**
 * @api {get} /groups/:groupId/users group users
 * @apiPermission admin
 * @apiName GetGroupUsers
 * @apiGroup Groups
 *
 * @apiParam {string} groupId
 *
 * @apiUse users
 * @apiSuccess {users[]} items list of users
 */

async function readUsers(req, res) {
  const {
    params: { groupId },
  } = req;

  const users = await groupService.findUserByGroupId(groupId);
  res.json({ items: users });
}

/**
 * @api {get} /groups/:groupId/templates group templates
 * @apiPermission admin
 * @apiName GetGroupTemplates
 * @apiGroup Groups
 *
 * @apiParam {string} groupId
 *
 * @apiUse templates
 * @apiSuccess {templates[]} items list of templates
 */

async function readTemplates(req, res) {
  const { groupId } = req.params;
  const [group, templates] = await Promise.all([
    Groups.findById(groupId).select('_id'),
    Templates.findForApi({ _company: groupId }),
  ]);
  if (!group) throw new NotFound();
  res.json({ items: templates });
}

/**
 * @api {get} /groups/:groupId/email-groups group emails
 * @apiPermission group_admin
 * @apiName GetEmailGroups
 * @apiGroup Groups
 *
 * @apiParam {string} groupId
 *
 * @apiUse emailsGroup
 * @apiSuccess {emailGroup[]} items list of email groups
 */

async function readEmailGroups(req, res) {
  const { groupId } = req.params;
  const emailGroups = await emailsGroupService.listEmailsGroups(groupId);
  if (!emailGroups) throw new NotFound();
  res.json({ items: emailGroups });
}

/**
 * @api {GET}  /groups/:groupId/profiles group profiles
 * @apiPermission admin
 * @apiName profilesList
 * @apiGroup Profiles
 *
 * @apiUse profile
 */

async function readProfiles(req, res) {
  const { groupId } = req.params;

  await groupService.findById(groupId);

  const profiles = await profileService.findAllByGroup({ groupId });
  res.json({ items: profiles });
}

/**
 * @api {get} /groups/:groupId/mailings group mailings
 * @apiPermission admin
 * @apiName GetGroupMailings
 * @apiGroup Groups
 *
 * @apiParam {string} groupId
 *
 * @apiUse mailings
 * @apiSuccess {mailings[]} items list of mailings
 */

async function readMailings(req, res) {
  const { groupId } = req.params;
  const { page: pageParam = 1, limit: limitParam = 10 } = req.query;
  const page = parseInt(pageParam);
  let limit = parseInt(limitParam);

  let skip = (page - 1) * limit; // Calculate the number of items to skip
  if (limit === -1) {
    limit = 0;
    skip = 0;
  }
  const group = await Groups.findById(groupId).select('_id');
  if (!group) {
    throw new NotFound();
  }

  // Retrieve mailings excluding the 'previewHtml' and 'data' fields and their total count
  const [mailings, totalItems] = await Promise.all([
    Mailings.find({ _company: groupId })
      .select('-previewHtml -data') // Exclude the 'previewHtml' and data field
      // in case limit = -1, we want to retrieve all mailings
      .skip(skip)
      .limit(limit),
    Mailings.countDocuments({ _company: groupId }), // Count all mailings for this group
  ]);

  res.json({
    items: mailings,
    totalItems,
    currentPage: page,
    totalPages: Math.ceil(totalItems / limit), // Calculate the total number of pages
  });
}

/**
 * @api {get} /groups/:groupId/workspaces group workspaces
 * @apiPermission admin
 * @apiName GetGroupWorkspaces
 * @apiGroup Groups
 *
 * @apiParam {string} groupId
 *
 * @apiUse workspace
 * @apiSuccess {workspaces[]} items list of workspaces
 */

async function readWorkspaces(req, res, next) {
  const { groupId } = req.params;
  if (!groupId) next(new NotFound());
  const workspaces = await findWorkspaces({ groupId });
  return res.json({ items: workspaces });
}

/**
 * @api {get} /groups/:groupId/color-scheme get group color scheme
 * @apiPermission user
 * @apiName GetGroupColorScheme
 * @apiGroup Groups
 *
 * @apiParam {string} groupId
 *
 * @apiUse workspace
 * @apiSuccess {colorScheme} group color scheme
 */
async function readColorScheme(req, res) {
  const {
    params: { groupId },
    user,
  } = req;
  if (!groupId) throw new NotFound();

  if (!user.isAdmin && user.group.id?.toString() !== groupId) {
    throw new NotFound();
  }

  const colorScheme = await groupService.findColorScheme({ groupId });
  return res.json({ items: colorScheme });
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
  const processedBody = groupFtpService.processCredentialsForUpdate(req.body);

  // Validate SSH key format if provided and not masked
  if (processedBody.ftpSshKey) {
    groupFtpService.validateSshKeyOrThrow(processedBody.ftpSshKey);
  }

  let groupToUpdate = {
    id: req.params.groupId,
    ...processedBody,
  };

  if (user.isGroupAdmin) {
    groupToUpdate = pick(groupToUpdate, ['name', 'id', 'colorScheme']);
  }

  await groupService.updateGroup(groupToUpdate);

  // Fetch the updated group to return with masked credentials
  const updatedGroup = await Groups.findById(req.params.groupId);
  res.json(groupFtpService.maskFtpCredentials(updatedGroup));
}

/**
 * @api {get} /groups/:groupId/personalized-variables get personalized variables for a group
 * @apiPermission group-admin or group-user
 * @apiName GetPersonalizedVariables
 * @apiGroup Groups
 *
 * @apiParam {string} groupId
 *
 * @apiSuccess {Object[]} items list of personalized variables
 */

async function readPersonalizedVariables(req, res) {
  const { groupId } = req.params;
  const variables = await personalizedVariableService.getGroupPersonalizedVariables(
    groupId
  );
  res.json({ items: variables });
}

/**
 * @api {post} /groups/:groupId/personalized-variables create or update personalized variables for a group
 * @apiPermission admin
 * @apiName createOrUpdatePersonalizedVariable
 * @apiGroup Groups
 *
 * @apiParam {string} groupId
 * @apiParam (Body) {Object[]} personalizedVariables array of personalized variables
 * @apiParam (Body) {String} personalizedVariables[].label the label of the personalized variable
 * @apiParam (Body) {String} personalizedVariables[].variable the variable of the personalized variable
 *
 * @apiSuccess {Object[]} items list of created personalized variables
 */

async function createOrUpdatePersonalizedVariables(req, res) {
  const { groupId } = req.params;
  const { personalizedVariables } = req.body;
  const createdVariables = await personalizedVariableService.createOrUpdatePersonalizedVariables(
    personalizedVariables,
    groupId
  );
  res.json({ items: createdVariables });
}

/**
 * @api {delete} /groups/:groupId/personalized-variables/:variableId delete personalized variable from a group
 * @apiPermission admin
 * @apiName DeletePersonalizedVariable
 * @apiGroup Groups
 *
 * @apiParam {string} groupId
 * @apiParam {string} variableId
 *
 * @apiSuccess {Object} result deletion result
 */

async function deletePersonalizedVariable(req, res) {
  const { groupId, variableId } = req.params;
  const result = await personalizedVariableService.deletePersonalizedVariable(
    variableId,
    groupId
  );
  res.json(result);
}

/**
 * @api {post} /groups/:groupId/test-ftp-connection Test FTP connection
 * @apiPermission admin
 * @apiName TestFtpConnection
 * @apiGroup Groups
 *
 * @apiParam {string} groupId
 *
 * @apiSuccess {Boolean} success connection result
 * @apiSuccess {String} message result message
 */
async function testFtpConnection(req, res) {
  const { groupId } = req.params;
  const group = await Groups.findById(groupId);

  if (!group) {
    throw new NotFound();
  }

  // Allow overriding FTP settings from the form (to test before saving)
  const ftpOverrides = [
    'downloadMailingWithFtpImages',
    'ftpAuthType',
    'ftpHost',
    'ftpPort',
    'ftpUsername',
    'ftpProtocol',
    'ftpPathOnServer',
    'ftpSshKey',
    'ftpPassword',
  ];
  for (const field of ftpOverrides) {
    if (req.body[field] !== undefined) {
      group[field] = req.body[field];
    }
  }

  const result = await groupFtpService.testConnection(group);
  return res.json(result);
}
