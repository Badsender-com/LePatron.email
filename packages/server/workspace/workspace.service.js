'use strict';

const { Workspaces } = require('../common/models.common.js');
const mongoose = require('mongoose');

module.exports = {
  createWorkspace,
  listWorkspace,
  findByGroupWithUserCount
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

async function findByGroupWithUserCount(groupId) {
  const workspaces = await Workspaces.aggregate([
    { $match: { _company: mongoose.Types.ObjectId(groupId) } },
    { $project: {
        name: 1,
        createdAt: 1,
        users: { $size: '$_users'}
      }
    }
  ]);
  console.log({workspaces})
  return workspaces;
}
