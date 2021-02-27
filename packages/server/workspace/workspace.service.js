'use strict';

const asyncHandler = require('express-async-handler');
const { Workspaces } = require('../common/models.common.js');

module.exports = {
  createWorkspace: asyncHandler(createWorkspace),
};

async function createWorkspace(workspaceParams) {
  const newWorkspace = await Workspaces.create({
    name: workspaceParams.name,
    _company: workspaceParams.group,
  });

  return newWorkspace;
}
