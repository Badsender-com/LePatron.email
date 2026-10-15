'use strict';

const asyncHandler = require('express-async-handler');
const permissions = require('../account/permissions.js');
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

// A template of the user's own group, or of any group for a super admin, who
// creates mailings in the group it works in (ADR 0002, amended).
async function doesUserHaveAccess(user, template) {
  if (
    !isTemplateInGroup(template, user.group?.id) &&
    !permissions.canManageGroup(user, template.group || template._company)
  ) {
    throw new NotFound(`${ERROR_CODES.TEMPLATE_NOT_FOUND} : ${template.name}`);
  }
}

function isTemplateInGroup(template, groupId) {
  return template?.group.toString() === groupId;
}
