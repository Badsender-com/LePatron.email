'use strict';

const asyncHandler = require('express-async-handler');
const permissions = require('../account/permissions.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');
const { refuseBootstrapAccount } = require('../account/request-scope.js');
const mongoose = require('mongoose');

const { NotFound, BadRequest } = require('http-errors');

const { Templates } = require('../common/models.common.js');
const ERROR_CODES = require('../constant/error-codes.js');
const modelsUtils = require('../utils/model.js');

module.exports = {
  listForUser,
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
  // Creating a mailing is a module write: the bootstrap account stays in the
  // settings.
  refuseBootstrapAccount(user);
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

/**
 * The template listing is shared by the global templates page, which lists
 * every group's to a super admin, and the new-mailing screen, which names the
 * selected group (ADR 0002, amended). Anyone else gets their own group's.
 *
 * @param {Object} user the request user
 * @param {string} [groupId] the group the screen names
 */
async function listForUser(user, groupId) {
  if (
    permissions.can(user, CAPABILITIES.PLATFORM_MANAGE) &&
    groupId !== undefined
  ) {
    if (!modelsUtils.isObjectIdString(groupId)) {
      throw new BadRequest(ERROR_CODES.INVALID_GROUP_PARAM);
    }
    return Templates.findForApi({ _company: groupId });
  }
  return Templates.findForApi(modelsUtils.addGroupFilter(user, {}));
}
