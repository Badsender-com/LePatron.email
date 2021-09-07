'use-strict';

const asyncHandler = require('express-async-handler');
const logger = require('../utils/logger');

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
  logger.log('emailGroupController:listEmailGroups');
  const { user } = req;
  const emailGroups = await emailGroupService.listEmailGroups(user?.group?.id);
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
  logger.log('emailGroupController:createEmailGroup');
  const {
    user,
    body: { name, emails },
  } = req;

  const emailGroup = await emailGroupService.createEmailGroup({
    name,
    emails,
    user,
  });

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
 * @apiUse emailGroup
 * @apiSuccess {EmailGroup} get Email group from id
 */
async function getEmailGroup(req, res) {
  logger.log('emailGroupController:getEmailGroup');
  const {
    user,
    params: { emailGroupId },
  } = req;

  const emailGroup = await emailGroupService.getEmailGroup({
    emailGroupId,
    user,
  });

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
  logger.log('emailGroupController:deleteEmailGroup');
  const {
    user,
    params: { emailGroupId },
  } = req;

  await emailGroupService.deleteEmailGroup({ user, emailGroupId });

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
  logger.log('emailGroupController:editEmailGroup');
  const {
    user,
    params: { emailGroupId },
    body: { name, emails },
  } = req;

  await emailGroupService.editEmailGroup({ emailGroupId, name, emails, user });

  res.status(204).send();
}
