'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true });

const assetController = require('./asset.controller.js');
const { GUARD_ADMIN } = require('../account/auth.guard.js');

// All asset routes require admin access
// Base path: /groups/:groupId/assets

// List all assets for a group
router.get('/', GUARD_ADMIN, assetController.listAssets);

// Create a new asset
router.post('/', GUARD_ADMIN, assetController.createAsset);

// Test connection (can test existing asset or new config)
router.post('/test-connection', GUARD_ADMIN, assetController.testConnection);

// Get a specific asset
router.get('/:assetId', GUARD_ADMIN, assetController.getAsset);

// Update an asset
router.put('/:assetId', GUARD_ADMIN, assetController.updateAsset);

// Delete an asset
router.delete('/:assetId', GUARD_ADMIN, assetController.deleteAsset);

module.exports = router;
