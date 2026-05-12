'use strict';

const express = require('express');

const router = express.Router();

const { GUARD_USER, GUARD_GROUP_ADMIN } = require('../account/auth.guard.js');
const audits = require('./audit.controller.js');

// List audits for a company
router.get('/groups/:groupId/audits', GUARD_GROUP_ADMIN, audits.list);

// Create audit for a company
router.post('/groups/:groupId/audits', GUARD_GROUP_ADMIN, audits.create);

// Get single audit
router.get('/audits/:auditId', GUARD_USER, audits.read);

// Update audit
router.put('/audits/:auditId', GUARD_GROUP_ADMIN, audits.update);

// Delete audit
router.delete('/audits/:auditId', GUARD_GROUP_ADMIN, audits.delete);

// Toggle inventory progress manually
router.put(
  '/audits/:auditId/inventory/progress',
  GUARD_USER,
  audits.toggleInventoryProgress
);

module.exports = router;
