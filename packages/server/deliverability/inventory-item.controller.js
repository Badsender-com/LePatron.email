'use strict';

const asyncHandler = require('express-async-handler');
const { pick } = require('lodash');
const inventoryItemService = require('./inventory-item.service');
const auditService = require('./audit.service');

module.exports = {
  list: asyncHandler(list),
  create: asyncHandler(create),
  bulkUpsert: asyncHandler(bulkUpsert),
  update: asyncHandler(update),
  delete: asyncHandler(deleteItem),
};

/**
 * @api {get} /deliverability/audits/:auditId/inventory List inventory items
 * @apiPermission user
 * @apiName ListInventoryItems
 * @apiGroup Deliverability
 *
 * @apiParam {string} auditId Audit ID
 * @apiParam {string} [category] Filter by category
 *
 * @apiSuccess {Object} items Inventory items (grouped by category if no filter)
 */
async function list(req, res) {
  const { user, params, query } = req;
  const { auditId } = params;
  const { category } = query;

  // Check authorization
  await auditService.checkIfUserIsAuthorizedToAccessAudit({ user, auditId });

  let items;
  if (category) {
    items = await inventoryItemService.findByAudit({ auditId, category });
    res.json({ items });
  } else {
    items = await inventoryItemService.getGroupedByCategory({ auditId });
    res.json({ items });
  }
}

/**
 * @api {post} /deliverability/audits/:auditId/inventory Create inventory item
 * @apiPermission user
 * @apiName CreateInventoryItem
 * @apiGroup Deliverability
 *
 * @apiParam {string} auditId Audit ID
 * @apiParam {string} category Item category
 * @apiParam {string} value Item value
 * @apiParam {string} [description] Item description
 *
 * @apiSuccess {Object} item Created inventory item
 */
async function create(req, res) {
  const { user, params, body } = req;
  const { auditId } = params;

  // Check authorization
  await auditService.checkIfUserIsAuthorizedToAccessAudit({ user, auditId });

  const itemData = {
    auditId,
    ...pick(body, ['category', 'value', 'description', 'metadata']),
  };

  const item = await inventoryItemService.createItem(itemData);
  res.status(201).json({ item });
}

/**
 * @api {post} /deliverability/audits/:auditId/inventory/bulk Bulk upsert inventory items
 * @apiPermission user
 * @apiName BulkUpsertInventoryItems
 * @apiGroup Deliverability
 *
 * @apiParam {string} auditId Audit ID
 * @apiParam {string} category Category to update
 * @apiParam {Object[]} items Array of items
 * @apiParam {string} items.value Item value
 * @apiParam {string} [items.description] Item description
 * @apiParam {boolean} [updateProgress=true] Update inventory progress
 *
 * @apiSuccess {Object[]} items Created/updated inventory items
 */
async function bulkUpsert(req, res) {
  const { user, params, body } = req;
  const { auditId } = params;
  const { category, items, updateProgress = true } = body;

  // Check authorization
  await auditService.checkIfUserIsAuthorizedToAccessAudit({ user, auditId });

  const createdItems = await inventoryItemService.bulkUpsertForCategory({
    auditId,
    category,
    items,
  });

  // Update inventory progress if requested
  if (updateProgress) {
    await auditService.updateInventoryProgress({
      auditId,
      step: category,
      completed: items.length > 0,
    });
  }

  res.json({ items: createdItems });
}

/**
 * @api {put} /deliverability/inventory-items/:itemId Update inventory item
 * @apiPermission user
 * @apiName UpdateInventoryItem
 * @apiGroup Deliverability
 *
 * @apiParam {string} itemId Item ID
 * @apiParam {string} [value] Item value
 * @apiParam {string} [description] Item description
 *
 * @apiSuccess {Object} item Updated inventory item
 */
async function update(req, res) {
  const { user, params, body } = req;
  const { itemId } = params;

  // Get item to check audit authorization
  const existingItem = await inventoryItemService.findById({ itemId });
  await auditService.checkIfUserIsAuthorizedToAccessAudit({
    user,
    auditId: existingItem.auditId,
  });

  const updateData = pick(body, ['value', 'description', 'metadata']);

  const item = await inventoryItemService.updateItem({
    itemId,
    data: updateData,
  });

  res.json({ item });
}

/**
 * @api {delete} /deliverability/inventory-items/:itemId Delete inventory item
 * @apiPermission user
 * @apiName DeleteInventoryItem
 * @apiGroup Deliverability
 *
 * @apiParam {string} itemId Item ID
 *
 * @apiSuccess {Object} message Success message
 */
async function deleteItem(req, res) {
  const { user, params } = req;
  const { itemId } = params;

  // Get item to check audit authorization
  const existingItem = await inventoryItemService.findById({ itemId });
  await auditService.checkIfUserIsAuthorizedToAccessAudit({
    user,
    auditId: existingItem.auditId,
  });

  await inventoryItemService.deleteItem({ itemId });

  res.json({ message: 'Inventory item deleted successfully' });
}
