'use-strict';

const asyncHandler = require('express-async-handler');

const emailGroupService = require('./email-group.service');

module.exports = {
  listEmailGroups: asyncHandler(listEmailGroups),
  createEmailGroup: asyncHandler(createEmailGroup),
  getEmailGroup: asyncHandler(getEmailGroup),
  deleteEmailGroup: asyncHandler(deleteEmailGroup),
  editEmailGroup: asyncHandler(editEmailGroup),
};

/**
 * @api {get} /email-group list of email groups
 * @apiPermission group_admin
 * @apiName listEmailGroups
 * @apiGroup EmailGroups
 *
 * @apiUse emailGroup
 * @apiSuccess {emailGroup[]} items list of email groups
 */
async function listEmailGroups(req, res) {
  const emailGroups = await emailGroupService.listFolders();
  res.json({
    items: emailGroups,
  });
}

/**
 * @api {post} /email-group/ create email group
 * @apiPermission group_admin
 * @apiName CreateEmailGroup
 * @apiGroup emailGroups
 *
 * @apiParam (Body) {String} name
 * @apiParam (Body) {String} emails
 *
 * @apiUse emailGroup
 * @apiSuccess {emailGroup} created Email group
 */
async function createEmailGroup(req, res) {
  const emailGroup = await emailGroupService.createEmailGroup({});

  res.json({
    emailGroup,
  });
}

/**
 * @api {get} /email-group/:emailGroupId Email Group update
 * @apiPermission group_admin
 * @apiName getEmailGroup
 * @apiGroup EmailGroup
 *
 * @apiUse EmailGroup
 * @apiSuccess {EmailGroup} get Email group from id
 */
async function getEmailGroup(req, res) {
  const {
    user,
    params: { emailGroupId },
  } = req;

  const emailGroup = await emailGroupService.getEmailGroup(emailGroupId, user);

  res.send(emailGroup);
}

/**
 * @api {delete} /email-group/:emailGroupId email group delete
 * @apiPermission group_admin
 * @apiName DeleteEmailGroup
 * @apiGroup EmailGroups
 *
 * @apiUse emailGroup
 * @apiSuccess {emailGroup} emailGroup deleted
 */

async function deleteEmailGroup(req, res) {
  const {
    user,
    params: { emailGroupId },
  } = req;

  await emailGroupService.deleteEmailGroup(user, emailGroupId);

  res.status(204).send();
}

/**
 * @api {put} /email-group/:emailGroupId email group edit
 * @apiPermission group_admin
 * @apiName PatchEmailGroup
 * @apiGroup EmailGroup
 *
 * @apiParam {string} emailGroupId
 *
 * @apiParam (Body) {String} name
 * @apiParam (Body) {String} emails
 *
 * @apiUse emailGroup
 * @apiSuccess {emailGroup} email group  edited
 */

async function editEmailGroup(req, res) {
  const {
    user,
    params: { emailGroupId },
    body: { name, mails },
  } = req;

  await emailGroupService.editEmailGroup({ emailGroupId, name, mails }, user);

  res.status(204).send();
}
