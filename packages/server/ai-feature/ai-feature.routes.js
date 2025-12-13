'use strict';

const express = require('express');

const router = express.Router();

const aiFeatures = require('./ai-feature.controller.js');

const { GUARD_USER, GUARD_GROUP_ADMIN } = require('../account/auth.guard.js');

// List available feature types
router.get('/types', GUARD_USER, aiFeatures.listFeatureTypes);

// Get AI features configuration for a group (Group Admin can manage their own group)
router.get('/groups/:groupId', GUARD_GROUP_ADMIN, aiFeatures.getConfig);

// Update specific feature configuration
router.put(
  '/groups/:groupId/features/:featureType',
  GUARD_GROUP_ADMIN,
  aiFeatures.updateFeature
);

module.exports = router;
