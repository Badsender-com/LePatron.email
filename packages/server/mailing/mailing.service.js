'use strict';

const asyncHandler = require('express-async-handler');

const { Mailings, Workspaces } = require('../common/models.common.js');
const mongoose = require('mongoose');
const { NotFound } = require('http-errors');

module.exports = {
  createMailing: asyncHandler(createMailing),
  findMailings: asyncHandler(findMailings),
  findTags: asyncHandler(findTags),
};

async function findMailings(query) {
  const {_workspace, _parentFolder} = query;

  if (_workspace) {
    query._workspace = mongoose.Types.ObjectId(_workspace);
  }

  if (_parentFolder) {
    query._parentFolder = mongoose.Types.ObjectId(_parentFolder);
  }

  return Mailings.findForApi(query);
}

async function findTags(query) {
  return Mailings.findTags(query)
}

async function createMailing(mailing) {
  if (
    !mailing?.workspace ||
    !Workspaces.exists({ _id: mongoose.Types.ObjectId(mailing?.workspace) })
  ) {
    throw new NotFound('Workspace not found');
  }
  return Mailings.create(mailing);
}
