'use strict';

const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');

const { NotFound } = require('http-errors');

const { Templates } = require('../common/models.common.js');
const ERROR_CODES = require('../constant/error-codes.js');

module.exports = {
  findOne: asyncHandler(findOne),
  doesUserHaveAccess: asyncHandler(doesUserHaveAccess),
};

async function findOne({ templateId }) {
  const template = Templates.findOne({
    _id: mongoose.Types.ObjectId(templateId),
  });

  if (!template) {
    throw new NotFound(ERROR_CODES.TEMPLATE_NOT_FOUND);
  }
  return template;
}

async function doesUserHaveAccess(user, template) {
  if (!isTemplateInGroup(template, user.group?.id)) {
    throw new NotFound(`${ERROR_CODES.TEMPLATE_NOT_FOUND} : ${template.name}`);
  }
}

function isTemplateInGroup(template, groupId) {
  return template?.group.toString() === groupId;
}
