'use strict';

const asyncHandler = require('express-async-handler');

const { Mailings, Workspaces } = require('../common/models.common.js');
const modelsUtils = require('../utils/model.js');
const mongoose = require('mongoose');
const { NotFound } = require('http-errors');

module.exports = {
  createMailing: asyncHandler(createMailing),
  findMailings: asyncHandler(findMailings),
  findTags: asyncHandler(findTags),
};

async function findMailings(query) {
  const mailingQuery = applyFilters(query);

  return Mailings.find(mailingQuery);
}

async function findTags(query) {
  const mailingQuery = applyFilters(query);

  return Mailings.findTags(mailingQuery);
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

function applyFilters(query) {
  const mailingQueryStrictGroup = modelsUtils.addStrictGroupFilter(
    query.user,
    {}
  );
  // const mailingQueryFolderParams = modelsUtils.addMailQueryParamFilter(query);

  return {
    ...mailingQueryStrictGroup,
    _workspace: query.workspaceId,
  };
}
