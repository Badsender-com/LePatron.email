'use strict';

const { Types } = require('mongoose');

const { EmailGroups } = require('../common/models.common.js');
const { NotFound, InternalServerError, Conflict } = require('http-errors');
const ERROR_CODES = require('../constant/error-codes.js');

module.exports = {
  listEmailGroups,
  createEmailGroup,
  getEmailGroup,
  deleteEmailGroup,
  editEmailGroup,
};

// TODO complete listEmailGroups
async function listEmailGroups(user) {
  return EmailGroups.find({
    _company: user.group.id,
  }).sort({ name: 1 });
}

async function createEmailGroup(name, emails, user) {
  if (await EmailGroups.exists({ name, _company: user.group.id })) {
    throw new Conflict(ERROR_CODES.EMAIL_GROUP_NAME_ALREADY_EXIST);
  }

  return EmailGroups.create({
    name,
    emails,
    _company: user.group.id,
  });
}

async function getEmailGroup({ emailGroupId, user }) {
  await checkIfEmailGroupExist(emailGroupId);

  const emailGroup = await EmailGroups.findById(emailGroupId);

  if (emailGroup.group !== user.group.id) {
    throw new NotFound(ERROR_CODES.EMAIL_GROUP_NOT_FOUND);
  }

  return emailGroup;
}

async function editEmailGroup({ emailGroupId, user, name, emails }) {
  await checkIfEmailGroupExist(emailGroupId);

  const emailGroup = await EmailGroups.findById(emailGroupId);

  if (emailGroup.group !== user.group.id) {
    throw new NotFound(ERROR_CODES.EMAIL_GROUP_NOT_FOUND);
  }

  return EmailGroups.updateOne(
    { _id: Types.ObjectId(emailGroupId) },
    {
      name,
      emails,
    }
  );
}

async function deleteEmailGroup(emailGroupId) {
  const emailGroup = await findOne(emailGroupId);

  const deleteEmailGroupResponse = await deleteOne(emailGroup.id);

  if (deleteEmailGroupResponse.ok !== 1) {
    throw new InternalServerError(ERROR_CODES.FAILED_EMAIL_GROUP_DELETE);
  }

  return deleteEmailGroupResponse;
}

async function deleteOne(emailGroupId) {
  return EmailGroups.deleteOne({ _id: Types.ObjectId(emailGroupId) });
}

async function findOne(emailGroupId) {
  await checkIfEmailGroupExist(emailGroupId);
  return EmailGroups.findOne({ _id: Types.ObjectId(emailGroupId) });
}

async function checkIfEmailGroupExist(emailGroupId) {
  if (!(await EmailGroups.exists({ _id: Types.ObjectId(emailGroupId) }))) {
    throw new NotFound(ERROR_CODES.EMAIL_GROUP_NOT_FOUND);
  }
}
