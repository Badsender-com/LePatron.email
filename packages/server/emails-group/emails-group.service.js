'use strict';

const { Types } = require('mongoose');

const { EmailsGroups } = require('../common/models.common.js');
const {
  NotFound,
  InternalServerError,
  Conflict,
  BadRequest,
  Unauthorized,
  Forbidden,
} = require('http-errors');
const ERROR_CODES = require('../constant/error-codes.js');
const logger = require('../utils/logger.js');
const permissions = require('../account/permissions.js');

module.exports = {
  listEmailsGroups,
  createEmailsGroup,
  getEmailsGroup,
  getEmailsGroupOfGroup,
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

  if (groupId !== undefined && typeof groupId !== 'string') {
    throw new BadRequest(ERROR_CODES.INVALID_OBJECT_ID);
  }
  // Only super admins may target a group different from their own.
  // Without this check, any group_admin could create an emails-group in another tenant.
  if (groupId && !permissions.canAccessGroup(user, groupId)) {
    throw new Forbidden(ERROR_CODES.FORBIDDEN_RESOURCE_OR_ACTION);
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

// The emails group, if `reaches` its company; one answer, not found, for a
// missing list and for another company's.
async function findEmailsGroupIn(emailsGroupId, reaches) {
  await checkIfEmailGroupExist(emailsGroupId);
  const emailsGroup = await EmailsGroups.findById(emailsGroupId);
  if (!reaches(emailsGroup._company)) {
    throw new NotFound(ERROR_CODES.EMAIL_GROUP_NOT_FOUND);
  }
  return emailsGroup;
}

async function getEmailsGroup({ emailsGroupId, user }) {
  logger.log('emailsGroupService:getEmailsGroup');
  return findEmailsGroupIn(emailsGroupId, (company) =>
    permissions.canAccessGroup(user, company)
  );
}

/**
 * An emails group of one given group only, whoever asks: the test send reads
 * the list among the sender's own group's.
 */
async function getEmailsGroupOfGroup({ emailsGroupId, groupId }) {
  logger.log('emailsGroupService:getEmailsGroupOfGroup');
  return findEmailsGroupIn(
    emailsGroupId,
    (company) => !!groupId && company?.toString() === String(groupId)
  );
}

async function editEmailsGroup({ emailsGroupId, name, emails, user }) {
  logger.log('emailsGroupService:editEmailsGroup');
  checkNameAndEmailsExists({ name, emails });

  if (!user) {
    throw new Unauthorized(ERROR_CODES.UNAUTHORIZED);
  }

  await findEmailsGroupIn(emailsGroupId, (company) =>
    permissions.canAccessGroup(user, company)
  );

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

  if (!permissions.canAccessGroup(user, emailsGroup._company)) {
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
