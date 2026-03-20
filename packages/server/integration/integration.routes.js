'use strict';

const express = require('express');

const router = express.Router();

const integrations = require('./integration.controller.js');

const { GUARD_USER, GUARD_GROUP_ADMIN } = require('../account/auth.guard.js');

// List available providers and types
router.get('/providers', GUARD_USER, integrations.listProviders);

// List integrations for a group (Group Admin can manage their own group)
router.get(
  '/groups/:groupId',
  GUARD_GROUP_ADMIN,
  integrations.listIntegrations
);

// Create integration for a group
router.post(
  '/groups/:groupId',
  GUARD_GROUP_ADMIN,
  integrations.createIntegration
);

// Read single integration
router.get('/:integrationId', GUARD_GROUP_ADMIN, integrations.readIntegration);

// Update integration
router.put(
  '/:integrationId',
  GUARD_GROUP_ADMIN,
  integrations.updateIntegration
);

// Delete integration
router.delete(
  '/:integrationId',
  GUARD_GROUP_ADMIN,
  integrations.deleteIntegration
);

// Validate integration credentials
router.post(
  '/:integrationId/validate',
  GUARD_GROUP_ADMIN,
  integrations.validateCredentials
);

// Get available models for an integration
router.get(
  '/:integrationId/models',
  GUARD_GROUP_ADMIN,
  integrations.getModels
);

module.exports = router;
