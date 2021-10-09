'use-strict';

const asyncHandler = require('express-async-handler');
const logger = require('../utils/logger');

const emailsGroupService = require('./emails-group.service');

module.exports = {
  listEmailsGroups: asyncHandler(listEmailGroups),
  createEmailsGroup: asyncHandler(createEmailGroup),
  getEmailsGroup: asyncHandler(getEmailsGroup),
  deleteEmailsGroup: asyncHandler(deleteEmailsGroup),
  editEmailsGroup: asyncHandler(editEmailGroup),
};

/**
 * @api {get} /emails-group list of emails groups
 * @apiPermission group_admin
 * @apiName listEmailsGroups
 * @apiGroup EmailsGroups
 *
 * @apiUse emailsGroup
 * @apiSuccess {emailsGroup[]} items list of emails groups
 */
async function listEmailGroups(req, res) {
  logger.log('emailsGroupController:listEmailsGroups');
  const { user } = req;
  const emailsGroups = await emailsGroupService.listEmailsGroups(
    user?.group?.id
  );
  res.json({
    items: emailsGroups,
  });
}

/**
 * @api {post} /emails-group/ create emails group
 * @apiPermission group_admin
 * @apiName CreateEmailsGroup
 * @apiGroup emailsGroups
 *
 * @apiParam (Body) {String} name
 * @apiParam (Body) {String} emails
 *
 * @apiUse emailsGroup
 * @apiSuccess {emailsGroup} created Emails group
 */
async function createEmailGroup(req, res) {
  logger.log('emailsGroupController:createEmailsGroup');
  const {
    user,
    body: { name, emails },
  } = req;

  const emailGroup = await emailsGroupService.createEmailsGroup({
    name,
    emails,
    user,
  });

  res.json({
    emailGroup,
  });
}

/**
 * @api {get} /email-group/:emailsGroupId Emails Group update
 * @apiPermission group_admin
 * @apiName getEmailsGroup
 * @apiGroup EmailsGroup
 *
 * @apiUse emailsGroup
 * @apiSuccess {EmailsGroup} get Emails group from id
 */
async function getEmailsGroup(req, res) {
  logger.log('emailsGroupController:getEmailsGroup');
  const {
    user,
    params: { emailsGroupId },
  } = req;

  const emailsGroup = await emailsGroupService.getEmailsGroup({
    emailsGroupId,
    userGroupId: user?.group?.id,
  });

  res.send(emailsGroup);
}

/**
 * @api {delete} /emails-group/:emailsGroupId emails group delete
 * @apiPermission group_admin
 * @apiName DeleteEmailsGroup
 * @apiGroup EmailsGroups
 *
 * @apiUse emailsGroup
 * @apiSuccess {emailsGroup} emailsGroup deleted
 */

async function deleteEmailsGroup(req, res) {
  logger.log('emailsGroupController:deleteEmailsGroup');
  const {
    user,
    params: { emailsGroupId },
  } = req;

  await emailsGroupService.deleteEmailsGroup({ user, emailsGroupId });

  res.status(204).send();
}

/**
 * @api {put} /emails-group/:emailsGroupId email group edit
 * @apiPermission group_admin
 * @apiName PatchEmailsGroup
 * @apiGroup EmailsGroup
 *
 * @apiParam {string} emailsGroupId
 *
 * @apiParam (Body) {String} name
 * @apiParam (Body) {String} emails
 *
 * @apiUse emailsGroup
 * @apiSuccess {emailsGroup} emails group  edited
 */

async function editEmailGroup(req, res) {
  logger.log('emailGroupController:editEmailGroup');
  const {
    user,
    params: { emailsGroupId },
    body: { name, emails },
  } = req;

  await emailsGroupService.editEmailsGroup({
    emailsGroupId,
    name,
    emails,
    user,
  });

  res.status(204).send();
}
