'use strict';

const createError = require('http-errors');
const permissions = require('../account/permissions.js');
const ERROR_CODES = require('../constant/error-codes.js');

// The group a request names, in its path, its body or its query: a super admin
// reaches every group, anyone else its own (account/permissions.js).
const guardCanAccessGroupFrom = (source) => {
  return (req, res, next) => {
    const { user } = req;
    if (!user) {
      return next(new createError.Unauthorized());
    }

    const { groupId } = req[source] || {};
    // A group is named by its id: an object in a body or a query string
    // (`groupId[_id]=`) is refused before anything reads it.
    if (groupId !== undefined && typeof groupId !== 'string') {
      return next(new createError.BadRequest(ERROR_CODES.INVALID_OBJECT_ID));
    }
    if (permissions.canAccessGroup(user, groupId)) {
      return next();
    }
    next(new createError.Unauthorized());
  };
};

module.exports = {
  GUARD_CAN_ACCESS_GROUP: guardCanAccessGroupFrom('params'),
  GUARD_CAN_ACCESS_GROUP_FROM_BODY: guardCanAccessGroupFrom('body'),
  GUARD_CAN_ACCESS_GROUP_FROM_QUERY: guardCanAccessGroupFrom('query'),
};
