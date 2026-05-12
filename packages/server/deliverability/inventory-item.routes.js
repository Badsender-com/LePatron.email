'use strict';

const express = require('express');

const router = express.Router();

const { GUARD_USER } = require('../account/auth.guard.js');
const inventoryItems = require('./inventory-item.controller.js');

// List inventory items for an audit
router.get('/audits/:auditId/inventory', GUARD_USER, inventoryItems.list);

// Create single inventory item
router.post('/audits/:auditId/inventory', GUARD_USER, inventoryItems.create);

// Bulk create/update inventory items for a category
router.post(
  '/audits/:auditId/inventory/bulk',
  GUARD_USER,
  inventoryItems.bulkUpsert
);

// Update inventory item
router.put('/inventory-items/:itemId', GUARD_USER, inventoryItems.update);

// Delete inventory item
router.delete('/inventory-items/:itemId', GUARD_USER, inventoryItems.delete);

module.exports = router;
