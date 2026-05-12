'use strict';

const prisma = require('../prisma-client');

/**
 * Resolve an array of inventory item IDs to their corresponding objects.
 * Returns an empty array if any ID is not found in the map.
 */
function resolveIds(ids, itemMap) {
  if (!Array.isArray(ids)) return [];
  return ids.map((id) => itemMap.get(id)).filter(Boolean);
}

/**
 * Enrich a raw MappingEntry with resolved InventoryItem objects.
 */
function enrichEntry(entry, itemMap) {
  return {
    ...entry,
    _platform: entry.platformId ? itemMap.get(entry.platformId) || null : null,
    _usage: entry.usageId ? itemMap.get(entry.usageId) || null : null,
    _fromDomains: resolveIds(entry.fromDomainIds, itemMap),
    _ips: resolveIds(entry.ipIds, itemMap),
    _mailFroms: resolveIds(entry.mailFromIds, itemMap),
    _replyTos: resolveIds(entry.replyToIds, itemMap),
    _trackingDomains: resolveIds(entry.trackingDomainIds, itemMap),
    _hostingDomains: resolveIds(entry.hostingDomainIds, itemMap),
    _linkDestinationDomains: resolveIds(
      entry.linkDestinationDomainIds,
      itemMap
    ),
  };
}

/**
 * Get all mapping groups and entries for an audit.
 * Entries are enriched with the resolved InventoryItem objects.
 */
async function findByAudit({ auditId }) {
  const [groups, entries, inventoryItems] = await Promise.all([
    prisma.mappingGroup.findMany({
      where: { auditId },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.mappingEntry.findMany({
      where: { auditId },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.inventoryItem.findMany({
      where: { auditId },
    }),
  ]);

  // Build a fast lookup map from inventory item ID to item object
  const itemMap = new Map(inventoryItems.map((item) => [item.id, item]));

  const enrichedEntries = entries.map((entry) => enrichEntry(entry, itemMap));

  return { groups, entries: enrichedEntries };
}

/**
 * Create a new mapping group for an audit.
 * sortOrder is set to the current number of groups (appended at the end).
 */
async function createGroup({ auditId, name }) {
  const count = await prisma.mappingGroup.count({ where: { auditId } });

  return prisma.mappingGroup.create({
    data: {
      auditId,
      name,
      sortOrder: count,
    },
  });
}

/**
 * Update a mapping group (name, isCollapsed, sortOrder).
 */
async function updateGroup({ groupId, data }) {
  return prisma.mappingGroup.update({
    where: { id: groupId },
    data,
  });
}

/**
 * Delete a mapping group.
 * Entries that belonged to this group remain but have their groupId set to null.
 */
async function deleteGroup({ groupId }) {
  return prisma.$transaction(async (tx) => {
    // Detach entries from the group before deleting it
    await tx.mappingEntry.updateMany({
      where: { groupId },
      data: { groupId: null },
    });

    return tx.mappingGroup.delete({
      where: { id: groupId },
    });
  });
}

/**
 * Create a new (empty) mapping entry for an audit.
 * sortOrder is set to the current number of entries (appended at the end).
 */
async function createEntry({ auditId, groupId }) {
  const count = await prisma.mappingEntry.count({ where: { auditId } });

  return prisma.mappingEntry.create({
    data: {
      auditId,
      groupId: groupId || null,
      sortOrder: count,
    },
  });
}

/**
 * Update any fields on a mapping entry.
 */
async function updateEntry({ entryId, data }) {
  return prisma.mappingEntry.update({
    where: { id: entryId },
    data,
  });
}

/**
 * Delete a mapping entry.
 */
async function deleteEntry({ entryId }) {
  return prisma.mappingEntry.delete({
    where: { id: entryId },
  });
}

/**
 * Bulk-update sortOrder for multiple entries.
 * Expects updates: [{ id, sortOrder }]
 */
async function reorderEntries({ auditId, updates }) {
  if (!Array.isArray(updates) || updates.length === 0) {
    return [];
  }

  return prisma.$transaction(
    updates.map(({ id, sortOrder }) =>
      prisma.mappingEntry.update({
        where: { id, auditId },
        data: { sortOrder },
      })
    )
  );
}

/**
 * Bulk-update sortOrder for multiple groups.
 * Expects updates: [{ id, sortOrder }]
 */
async function reorderGroups({ auditId, updates }) {
  if (!Array.isArray(updates) || updates.length === 0) return [];
  return prisma.$transaction(
    updates.map(({ id, sortOrder }) =>
      prisma.mappingGroup.update({
        where: { id, auditId },
        data: { sortOrder },
      })
    )
  );
}

module.exports = {
  findByAudit,
  createGroup,
  updateGroup,
  deleteGroup,
  createEntry,
  updateEntry,
  deleteEntry,
  reorderEntries,
  reorderGroups,
};
