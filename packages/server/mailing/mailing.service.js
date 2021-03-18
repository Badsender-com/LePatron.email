'use strict';

const { omit } = require('lodash');
const { Mailings, Workspaces, Galleries } = require('../common/models.common.js');
const modelsUtils = require('../utils/model.js');
const fileManager = require('../common/file-manage.service.js');
const logger = require('../utils/logger.js');
const mongoose = require('mongoose');
const ERROR_CODES = require('../constant/error-codes.js');
const { NotFound } = require('http-errors');

module.exports = {
  createMailing,
  findMailings,
  findTags,
  findOne,
  renameMailing,
  deleteOne,
  copyMailing
};

async function findMailings(query) {
  const mailingQuery = applyFilters(query);

  return Mailings.find(mailingQuery);
}

async function findTags(query) {
  const mailingQuery = applyFilters(query);

  return Mailings.findTags(mailingQuery);
}

async function findOne(mailingId) {
  return Mailings.findOne({ _id: mongoose.Types.ObjectId(mailingId) });
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

async function copyMailing(mailing, destinationWorkspace) {
  if (!Workspaces.exists({ _id: mongoose.Types.ObjectId(destinationWorkspace.id) })) {
    throw new NotFound(ERROR_CODES.WORKSPACE_NOT_FOUND);
  }

  const mailingProperties = omit(mailing, ['_id', 'createdAt', 'updatedAt']);

  const copy = {
    ...mailingProperties,
    workspace: destinationWorkspace.id
  }

  const copiedMailing = await Mailings.create(copy);
  const gallery = await Galleries.findOne({ creationOrWireframeId: mailing._id });

  await fileManager.copyImages(mailing._id, copiedMailing._id);
  await copiedMailing.save();

  try {
    if (gallery) {
      gallery.duplicate(copiedMailing._id).save();
    }
  } catch (error) {
    logger.warn(`MAILING DUPLICATE – can't duplicate gallery for ${copiedMailing._id}`);
  }

}

async function renameMailing(mailing) {
  if (
    !mailing?.workspace ||
    !Workspaces.exists({ _id: mongoose.Types.ObjectId(mailing.workspace) })
  ) {
    throw new NotFound(ERROR_CODES.WORKSPACE_NOT_FOUND);
  }
  const { id, name } = mailing;

  return Mailings.updateOne({ _id: mongoose.Types.ObjectId(id) }, { name });
}

async function deleteOne(mailing) {
  return Mailings.deleteOne({ _id: mongoose.Types.ObjectId(mailing.id) });
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
