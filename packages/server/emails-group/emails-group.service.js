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

async function createEmailsGroup({ name, emails, user }) {
  logger.log('emailsGroupService:createEmailsGroup');
  checkNameAndEmailsExists({ name, emails });

  if (!user) {
    throw new Unauthorized(ERROR_CODES.UNAUTHORIZED);
  }

  if (await EmailsGroups.exists({ name, _company: user.group.id })) {
    throw new Conflict(ERROR_CODES.EMAIL_GROUP_NAME_ALREADY_EXIST);
  }

  return EmailsGroups.create({
    name,
    emails,
    _company: user.group.id,
  });
}

async function getEmailsGroup({ emailsGroupId, userGroupId }) {
  logger.log('emailsGroupService:getEmailsGroup');
  logger.log({ emailsGroupId });
  await checkIfEmailGroupExist(emailsGroupId);

  const emailsGroup = await EmailsGroups.findById(emailsGroupId);

  console.log({
    emailsGroupGroupId: emailsGroup.group?.toString(),
    userGroupId,
  });

  if (emailsGroup.group?.toString() !== userGroupId) {
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

  if (emailsGroup.group?.toString() !== user.group.id) {
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

  const deleteEmailsGroupResponse = await deleteOne(emailsGroup.id);

  if (emailsGroup.group?.toString() !== user.group.id) {
    throw new NotFound(ERROR_CODES.EMAIL_GROUP_NOT_FOUND);
  }

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
