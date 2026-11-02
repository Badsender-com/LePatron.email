'use strict';

const express = require('express');
const createError = require('http-errors');

const router = express.Router();

const {
  GUARD_ADMIN,
  GUARD_GROUP_ADMIN,
  guard,
  GUARD_USER,
} = require('../account/auth.guard.js');
const groups = require('./group.controller.js');
const { GUARD_CAN_ACCESS_GROUP } = require('./group.guard.js');
const ERROR_CODES = require('../constant/error-codes.js');
const { isObjectIdString } = require('../utils/model.js');

// A page reloaded without a group in hand used to call `/groups/undefined/…`,
// which failed on the cast of the id as a server error. Every `:groupId` that
// is not an id is refused here, before any guard or controller reads it.
router.param('groupId', (req, res, next, groupId) => {
  if (!isObjectIdString(groupId)) {
    return next(createError(400, ERROR_CODES.INVALID_GROUP_PARAM));
  }
  return next();
});

router.get('/', GUARD_ADMIN, groups.list);
router.post('', GUARD_ADMIN, groups.create);
router.put('/:groupId/platform', GUARD_ADMIN, groups.setPlatform);
router.delete('/:groupId', GUARD_ADMIN, groups.deleteGroup);
router.post('/seed-groups', GUARD_ADMIN, groups.seedGroups);

// guard() will check if the user is logged
router.get('/:groupId', guard(), GUARD_CAN_ACCESS_GROUP, groups.read);

router.put(
  '/:groupId',
  GUARD_GROUP_ADMIN,
  GUARD_CAN_ACCESS_GROUP,
  groups.update
);

router.get(
  '/:groupId/users',
  guard(), // guard() will check if the user is logged
  GUARD_CAN_ACCESS_GROUP,
  groups.readUsers
);

router.get(
  '/:groupId/templates',
  guard(), // guard() will check if the user is logged
  GUARD_CAN_ACCESS_GROUP,
  groups.readTemplates
);

router.get(
  '/:groupId/workspaces',
  GUARD_GROUP_ADMIN, // guard() will check if the user is logged
  GUARD_CAN_ACCESS_GROUP,
  groups.readWorkspaces
);

router.get(
  '/:groupId/email-groups',
  GUARD_USER, // guard() will check if the user is logged
  GUARD_CAN_ACCESS_GROUP,
  groups.readEmailGroups
);

router.get(
  '/:groupId/color-scheme',
  GUARD_USER, // guard() will check if the user is logged
  groups.readColorScheme
);

router.get(
  '/:groupId/mailings',
  guard(), // guard() will check if the user is logged
  GUARD_CAN_ACCESS_GROUP,
  groups.readMailings
);

router.get(
  '/:groupId/profiles',
  guard(), // guard() will check if the user is logged
  GUARD_ADMIN,
  groups.readProfiles
);

// New personalized variable routes
router.get(
  '/:groupId/personalized-variables',
  guard(),
  GUARD_CAN_ACCESS_GROUP,
  groups.readPersonalizedVariables
);
router.post(
  '/:groupId/personalized-variables',
  GUARD_GROUP_ADMIN,
  GUARD_CAN_ACCESS_GROUP,
  groups.createOrUpdatePersonalizedVariables
);
router.delete(
  '/:groupId/personalized-variables/:variableId',
  GUARD_GROUP_ADMIN,
  GUARD_CAN_ACCESS_GROUP,
  groups.deletePersonalizedVariable
);

// FTP connection test
router.post(
  '/:groupId/test-ftp-connection',
  GUARD_ADMIN,
  groups.testFtpConnection
);

// Note: CRM Intelligence configuration is now done through /api/integrations routes
// See packages/server/integration/integration.routes.js

// catch anything and forward to error handler
router.use((req, res, next) => {
  next(new createError.NotImplemented());
});

module.exports = router;
