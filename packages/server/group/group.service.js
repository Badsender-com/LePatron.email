'use strict';

const asyncHandler = require('express-async-handler');
const createError = require('http-errors');
const ERROR_CODES = require('../constant/error-codes.js');
const { Groups, Users, Workspaces, Mailings } = require('../common/models.common.js');
const mongoose = require('mongoose');
const workspaceService = require('../workspace/workspace.service.js');

module.exports = {
  findById: asyncHandler(findById),
  createGroup: asyncHandler(createGroup),
  updateGroup: asyncHandler(updateGroup),
  findUserByGroupId: asyncHandler(findUserByGroupId),
  seedGroups
};

async function seedGroups() {
  // retrieving groups that need to be updated
  const companiesWithWorkspacesIds = await Workspaces.distinct('_company');
  const companiesWithNoWorkspaces = await Groups.find(
    { _id: { $nin: companiesWithWorkspacesIds.map(id => mongoose.Types.ObjectId(id)) } }
  );

  // for each of these groups, create default workspace and add group users to it
  for (const company of companiesWithNoWorkspaces) {
    const companyUsers = await Users.find({ _company: mongoose.Types.ObjectId(company.id) });

    const defaultWorkspace = {
      name: 'Workspace',
      groupId: company.id,
      selectedUsers: companyUsers
    };

    const createdWorkspace = await workspaceService.createWorkspace(defaultWorkspace);

    if (!createdWorkspace) {
      throw new createError.InternalServerError(ERROR_CODES.FAILED_WORKSPACE_CREATION)
    }

    const companyMailings = await Mailings.find({ _company: mongoose.Types.ObjectId(company.id) });

    const moveMailingsToWorkspace = await Mailings.updateMany(
      { _id: { $in: companyMailings.map(mailing => mailing.id) } },
      { _workspace: createdWorkspace._id }
    );

    if (moveMailingsToWorkspace.ok !== 1) {
      throw new createError.InternalServerError(ERROR_CODES.FAILED_MAILING_MOVE)
    }
  }

  return companiesWithNoWorkspaces;
}

async function findById(groupId) {
  const group = await Groups.findById(groupId).select('_id').lean();
  if (!group) {
    throw new createError.NotFound(`no group with id ${groupId} found`);
  }
  return group;
}

async function findUserByGroupId(groupId) {
  const [group, users] = await Promise.all([
    Groups.findById(groupId).select('_id'),
    Users.find({
      _company: groupId,
    })
      .populate({ path: '_company', select: 'id name entryPoint issuer' })
      .sort({ email: 1 }),
  ]);
  if (!group) throw new createError.NotFound();
  return users;
}
async function createGroup(group) {
  return Groups.create(group);
}

async function updateGroup(group) {
  const { id, ...otherProperties } = group;

  await Groups.updateOne(
    { _id: mongoose.Types.ObjectId(id) },
    { ...otherProperties }
  );
}
