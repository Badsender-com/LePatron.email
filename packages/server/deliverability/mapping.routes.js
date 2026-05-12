'use strict';

const express = require('express');

const router = express.Router();

const { GUARD_USER } = require('../account/auth.guard.js');
const mapping = require('./mapping.controller.js');

// Get all mapping groups and entries for an audit
router.get('/audits/:auditId/mapping', GUARD_USER, mapping.getMapping);

// Create a mapping group
router.post('/audits/:auditId/mapping/groups', GUARD_USER, mapping.createGroup);

// Update a mapping group
router.put(
  '/audits/:auditId/mapping/groups/:groupId',
  GUARD_USER,
  mapping.updateGroup
);

// Delete a mapping group
router.delete(
  '/audits/:auditId/mapping/groups/:groupId',
  GUARD_USER,
  mapping.deleteGroup
);

// Create a mapping entry
router.post(
  '/audits/:auditId/mapping/entries',
  GUARD_USER,
  mapping.createEntry
);

// Update a mapping entry
router.put(
  '/audits/:auditId/mapping/entries/:entryId',
  GUARD_USER,
  mapping.updateEntry
);

// Delete a mapping entry
router.delete(
  '/audits/:auditId/mapping/entries/:entryId',
  GUARD_USER,
  mapping.deleteEntry
);

// Bulk reorder mapping entries
router.post(
  '/audits/:auditId/mapping/reorder',
  GUARD_USER,
  mapping.reorderEntries
);

// Bulk reorder mapping groups
router.post(
  '/audits/:auditId/mapping/reorder-groups',
  GUARD_USER,
  mapping.reorderGroups
);

module.exports = router;
