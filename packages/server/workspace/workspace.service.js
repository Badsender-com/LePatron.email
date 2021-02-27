'use strict';

const { Workspaces } = require('../common/models.common.js');
const mongoose = require('mongoose');

module.exports = {
  createWorkspace,
  listWorkspace,
};

async function createWorkspace(workspaceParams) {
  const newWorkspace = await Workspaces.create({
    name: workspaceParams.name,
    _company: workspaceParams.group,
  });

  return newWorkspace;
}

async function listWorkspace({ id }) {
  const workspaces = await Workspaces.find({
    _company: mongoose.Types.ObjectId(id),
  }).populate({
    path: 'folders',
    populate: { path: 'childFolders' },
  });
  return workspaces;
}
