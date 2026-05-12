'use strict';

const prisma = require('../prisma-client');
const createError = require('http-errors');

/**
 * List inventory items for an audit
 * Optionally filter by category
 */
async function findByAudit({ auditId, category }) {
  const where = { auditId };

  if (category) {
    where.category = category.toUpperCase();
  }

  return prisma.inventoryItem.findMany({
    where,
    orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
  });
}

/**
 * Create a single inventory item
 */
async function createItem({ auditId, category, value, description }) {
  // Check for duplicates (unique constraint on auditId + category + value)
  const existing = await prisma.inventoryItem.findFirst({
    where: {
      auditId,
      category: category.toUpperCase(),
      value,
    },
  });

  if (existing) {
    throw createError.Conflict('This inventory item already exists');
  }

  return prisma.inventoryItem.create({
    data: {
      auditId,
      category: category.toUpperCase(),
      value,
      description,
    },
  });
}

/**
 * Bulk upsert inventory items for a specific category
 * This replaces all items for a category with the new list
 */
async function bulkUpsertForCategory({ auditId, category, items }) {
  const categoryUpper = category.toUpperCase();

  // Use a transaction to ensure consistency
  return prisma.$transaction(async (tx) => {
    // Delete existing items for this category
    await tx.inventoryItem.deleteMany({
      where: {
        auditId,
        category: categoryUpper,
      },
    });

    // Create new items
    const createdItems = await Promise.all(
      items.map((item) =>
        tx.inventoryItem.create({
          data: {
            auditId,
            category: categoryUpper,
            value: item.value,
            description: item.description || null,
          },
        })
      )
    );

    return createdItems;
  });
}

/**
 * Update inventory item
 */
async function updateItem({ itemId, data }) {
  return prisma.inventoryItem.update({
    where: { id: itemId },
    data,
  });
}

/**
 * Delete inventory item
 */
async function deleteItem({ itemId }) {
  return prisma.inventoryItem.delete({
    where: { id: itemId },
  });
}

/**
 * Find inventory item by ID
 */
async function findById({ itemId }) {
  const item = await prisma.inventoryItem.findUnique({
    where: { id: itemId },
  });

  if (!item) {
    throw createError.NotFound('Inventory item not found');
  }

  return item;
}

/**
 * Get inventory items grouped by category
 */
async function getGroupedByCategory({ auditId }) {
  const items = await prisma.inventoryItem.findMany({
    where: { auditId },
    orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
  });

  // Group items by category
  const grouped = items.reduce((acc, item) => {
    const category = item.category.toLowerCase();
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {});

  return grouped;
}

module.exports = {
  findByAudit,
  createItem,
  bulkUpsertForCategory,
  updateItem,
  deleteItem,
  findById,
  getGroupedByCategory,
};
