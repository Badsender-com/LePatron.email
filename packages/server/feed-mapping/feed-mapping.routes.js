'use strict';

const express = require('express');
const createError = require('http-errors');

const router = express.Router();

const feedMappings = require('./feed-mapping.controller.js');
const { GUARD_USER, GUARD_GROUP_ADMIN } = require('../account/auth.guard.js');

// List active feed mappings for a template. GUARD_USER on purpose: any user
// editing a mailing on that template needs to discover available mappings,
// not just group admins (who own create/update/delete of the mapping itself).
router.get('', GUARD_USER, feedMappings.listFeedMappingsForTemplate);

router.get(
  '/groups/:groupId',
  GUARD_GROUP_ADMIN,
  feedMappings.listFeedMappingsForGroup
);

router.post('', GUARD_GROUP_ADMIN, feedMappings.createFeedMapping);
router.put(
  '/:feedMappingId',
  GUARD_GROUP_ADMIN,
  feedMappings.updateFeedMapping
);
router.delete(
  '/:feedMappingId',
  GUARD_GROUP_ADMIN,
  feedMappings.deleteFeedMapping
);

// catch anything and forward to error handler
router.use((req, res, next) => {
  next(new createError.NotImplemented());
});

module.exports = router;
