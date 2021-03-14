'use strict';

const asyncHandler = require('express-async-handler');

const { Mailings, Workspaces } = require('../common/models.common.js');
const mongoose = require('mongoose');
const { NotFound } = require('http-errors');

module.exports = {
  createMailing: asyncHandler(createMailing),
  findMailings: asyncHandler(findMailings),
};

async function findMailings({ workspaceId }) {
  const filterQuery = {};
  if (workspaceId) {
    filterQuery._workspace = mongoose.Types.ObjectId(workspaceId);
  }
  return await Mailings.find(filterQuery);
}

async function createMailing(mailing) {
  console.log({ mailing });
  if (
    !mailing?.workspace ||
    !Workspaces.exists({ _id: mongoose.Types.ObjectId(mailing?.workspace) })
  ) {
    throw new NotFound('Workspace not found');
  }
  return await Mailings.create(mailing);
}
