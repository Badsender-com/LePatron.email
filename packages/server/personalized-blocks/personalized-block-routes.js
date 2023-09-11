'use strict';

const express = require('express');
const { guard } = require('../account/auth.guard.js');
const {
  GUARD_CAN_ACCESS_GROUP_FROM_BODY,
  GUARD_CAN_ACCESS_GROUP_FROM_QUERY,
} = require('../group/group.guard.js');
const createError = require('http-errors');

const router = express.Router();

const personalizedBlocksController = require('./personalized-block-controller.js');
const Roles = require('../account/roles.js');

// Get list of personalized blocks
router.get(
  '/',
  guard(),
  GUARD_CAN_ACCESS_GROUP_FROM_QUERY,
  personalizedBlocksController.listPersonalizedBlocks
);

// Create a new personalized block
router.post(
  '/',
  guard(),
  GUARD_CAN_ACCESS_GROUP_FROM_BODY,
  personalizedBlocksController.createPersonalizedBlock
);

// Update a personalized block by ID
router.put(
  '/:id',
  guard([Roles.GROUP_ADMIN, Roles.SUPER_ADMIN]),
  GUARD_CAN_ACCESS_GROUP_FROM_BODY,
  personalizedBlocksController.updatePersonalizedBlock
);

// Delete a personalized block by ID
router.delete(
  '/:id',
  guard([Roles.GROUP_ADMIN, Roles.SUPER_ADMIN]),
  GUARD_CAN_ACCESS_GROUP_FROM_QUERY,
  personalizedBlocksController.deletePersonalizedBlock
);

// catch anything and forward to error handler
router.use((req, res, next) => {
  next(new createError.NotImplemented());
});

module.exports = router;
