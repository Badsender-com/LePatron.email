'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true });

const exportProfileController = require('./export-profile.controller.js');
const { GUARD_ADMIN } = require('../account/auth.guard.js');

// All export profile routes require admin access
// Base path: /groups/:groupId/export-profiles

// List all export profiles for a group
router.get('/', GUARD_ADMIN, exportProfileController.listExportProfiles);

// Create a new export profile
router.post('/', GUARD_ADMIN, exportProfileController.createExportProfile);

// Get a specific export profile
router.get('/:exportProfileId', GUARD_ADMIN, exportProfileController.getExportProfile);

// Update an export profile
router.put('/:exportProfileId', GUARD_ADMIN, exportProfileController.updateExportProfile);

// Delete an export profile
router.delete('/:exportProfileId', GUARD_ADMIN, exportProfileController.deleteExportProfile);

module.exports = router;
