'use strict';

const { Types } = require('mongoose');

const { EmailsGroups } = require('../common/models.common.js');
const {
  NotFound,
  InternalServerError,
  Conflict,
  BadRequest,
  Unauthorized,
} = require('http-errors');
const ERROR_CODES = require('../constant/error-codes.js');
const logger = require('../utils/logger.js');

module.exports = {
  listEmailsGroups,
  createEmailsGroup,
  getEmailsGroup,
  deleteEmailsGroup,
  editEmailsGroup,
};

// TODO complete listEmailGroups
async function listEmailsGroups(groupId) {
  logger.log('emailsGroupService:ListEmailsGroups');
  if (!groupId) {
    throw new BadRequest(ERROR_CODES.MISSING_GROUP_PARAM);
  }

  return EmailsGroups.find({
    _company: groupId,
  }).sort({ name: 1 });
}

async function createEmailsGroup({ name, emails, user, groupId }) {
  logger.log('emailsGroupService:createEmailsGroup');
  checkNameAndEmailsExists({ name, emails });

  if (!user) {
    throw new Unauthorized(ERROR_CODES.UNAUTHORIZED);
  }

  // Use explicit groupId if provided (for admin users), otherwise fallback to user's group
  const companyId = groupId || user.group?.id;

  if (!companyId) {
    throw new BadRequest(ERROR_CODES.MISSING_GROUP_PARAM);
  }

  if (await EmailsGroups.exists({ name, _company: companyId })) {
    throw new Conflict(ERROR_CODES.EMAIL_GROUP_NAME_ALREADY_EXIST);
  }

  return EmailsGroups.create({
    name,
    emails,
    _company: companyId,
  });
}

async function getEmailsGroup({ emailsGroupId, userGroupId, isAdmin }) {
  logger.log('emailsGroupService:getEmailsGroup');
  await checkIfEmailGroupExist(emailsGroupId);

  const emailsGroup = await EmailsGroups.findById(emailsGroupId);

  // Admin users can access any emails group
  // Regular users can only access their own group's emails groups
  if (!isAdmin && emailsGroup._company?.toString() !== userGroupId) {
    throw new NotFound(ERROR_CODES.EMAIL_GROUP_NOT_FOUND);
  }

  return emailsGroup;
}

async function editEmailsGroup({ emailsGroupId, name, emails, user }) {
  logger.log('emailsGroupService:editEmailsGroup');
  checkNameAndEmailsExists({ name, emails });

  if (!user) {
    throw new Unauthorized(ERROR_CODES.UNAUTHORIZED);
  }

  await checkIfEmailGroupExist(emailsGroupId);

  const emailsGroup = await EmailsGroups.findById(emailsGroupId);

  // Admin users can edit any emails group
  // Regular users can only edit their own group's emails groups
  if (!user.isAdmin && emailsGroup._company?.toString() !== user.group?.id) {
    throw new NotFound(ERROR_CODES.EMAIL_GROUP_NOT_FOUND);
  }

  return EmailsGroups.updateOne(
    { _id: Types.ObjectId(emailsGroupId) },
    {
      name,
      emails,
    }
  );
}

async function deleteEmailsGroup({ emailsGroupId, user }) {
  logger.log('emailsGroupService:deleteEmailsGroup');
  const emailsGroup = await findOne(emailsGroupId);

  // Admin users can delete any emails group
  // Regular users can only delete their own group's emails groups
  if (!user.isAdmin && emailsGroup._company?.toString() !== user.group?.id) {
    throw new NotFound(ERROR_CODES.EMAIL_GROUP_NOT_FOUND);
  }

  const deleteEmailsGroupResponse = await deleteOne(emailsGroup.id);

  if (deleteEmailsGroupResponse.ok !== 1) {
    throw new InternalServerError(ERROR_CODES.FAILED_EMAIL_GROUP_DELETE);
  }

  return deleteEmailsGroupResponse;
}

async function deleteOne(emailsGroupId) {
  return EmailsGroups.deleteOne({ _id: Types.ObjectId(emailsGroupId) });
}

async function findOne(emailsGroupId) {
  await checkIfEmailGroupExist(emailsGroupId);
  return EmailsGroups.findOne({ _id: Types.ObjectId(emailsGroupId) });
}

async function checkIfEmailGroupExist(emailsGroupId) {
  if (!(await EmailsGroups.exists({ _id: Types.ObjectId(emailsGroupId) }))) {
    throw new NotFound(ERROR_CODES.EMAIL_GROUP_NOT_FOUND);
  }
}

function checkNameAndEmailsExists({ name, emails }) {
  if (!name) {
    throw new BadRequest(ERROR_CODES.MISSING_EMAIL_GROUP_NAME_PARAM);
  }

  if (!emails) {
    throw new BadRequest(ERROR_CODES.MISSING_EMAIL_GROUP_NAME_PARAM);
  }
}
