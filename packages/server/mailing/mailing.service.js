'use strict';

const { Mailings, Workspaces } = require('../common/models.common.js');
const modelsUtils = require('../utils/model.js');
const mongoose = require('mongoose');
const ERROR_CODES = require('../constant/error-codes.js');
const { NotFound } = require('http-errors');

module.exports = {
  createMailing,
  findMailings,
  findTags,
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
    !Workspaces.exists({ _id: mongoose.Types.ObjectId(mailing.workspace) })
  ) {
    throw new NotFound(ERROR_CODES.WORKSPACE_NOT_FOUND);
  }
  return Mailings.create(mailing);
}

function applyFilters(query) {
  const mailingQueryStrictGroup = modelsUtils.addStrictGroupFilter(
    query.user,
    {}
  );

  return {
    ...mailingQueryStrictGroup,
    _workspace: query.workspaceId,
  };
}
