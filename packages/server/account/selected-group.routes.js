'use strict';

const express = require('express');
const asyncHandler = require('express-async-handler');
const createError = require('http-errors');

const ERROR_CODES = require('../constant/error-codes.js');
const { isObjectIdString } = require('../utils/model.js');
const { guard } = require('./auth.guard.js');
const { resolveSelectedGroup, selectGroup } = require('./selected-group.js');
const permissions = require('./permissions.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');

const router = express.Router();

// GET  /api/users/me/selected-group → { selectedGroup: { id, name } | null }
router.get(
  '/',
  guard(),
  asyncHandler(async (req, res) => {
    res.json({
      selectedGroup: await resolveSelectedGroup(req.user, req.session),
    });
  })
);

// PUT /api/users/me/selected-group { groupId } → { selectedGroup }
// A super admin stores it on its account, the bootstrap account in its
// session. Anyone else's selected group is their own group.
router.put(
  '/',
  guard(),
  asyncHandler(async (req, res) => {
    const { user } = req;
    if (!permissions.can(user, CAPABILITIES.PLATFORM_MANAGE)) {
      throw new createError.Forbidden(ERROR_CODES.FORBIDDEN_RESOURCE_OR_ACTION);
    }

    const { groupId } = req.body || {};
    if (!isObjectIdString(groupId)) {
      throw new createError.BadRequest(ERROR_CODES.INVALID_GROUP_PARAM);
    }

    const selectedGroup = await selectGroup(req, groupId);
    if (!selectedGroup) {
      throw new createError.NotFound(ERROR_CODES.GROUP_NOT_FOUND);
    }

    res.json({ selectedGroup });
  })
);

module.exports = router;
