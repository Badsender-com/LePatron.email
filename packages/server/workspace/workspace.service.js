'use strict'

const createError = require('http-errors');
const asyncHandler = require('express-async-handler');
const { Workspaces } = require('../common/models.common.js');

module.exports = {
  createWorkspace: asyncHandler(createWorkspace),
}

async function createWorkspace(workspaceParams) {
  const newWorkspace = await Workspaces.create({
    name: workspaceParams.name,
    _company: workspaceParams.group
  });
  if (!newWorkspace) {
    throw new createError.InternalServerError('workspace.service : An error occurred while creating new workspace')
  }
  return newWorkspace;
}
