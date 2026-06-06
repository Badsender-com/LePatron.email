'use strict';

const asyncHandler = require('express-async-handler');
const { pick } = require('lodash');
const auditService = require('./audit.service');
const mappingService = require('./mapping.service');

module.exports = {
  getMapping: asyncHandler(getMapping),
  createGroup: asyncHandler(createGroup),
  updateGroup: asyncHandler(updateGroup),
  deleteGroup: asyncHandler(deleteGroup),
  createEntry: asyncHandler(createEntry),
  updateEntry: asyncHandler(updateEntry),
  deleteEntry: asyncHandler(deleteEntry),
  reorderEntries: asyncHandler(reorderEntries),
  reorderGroups: asyncHandler(reorderGroups),
};

// Fields that callers are allowed to set when updating a group
const ALLOWED_GROUP_UPDATE_FIELDS = ['name', 'isCollapsed', 'sortOrder'];

// Fields that callers are allowed to set when updating an entry
const ALLOWED_ENTRY_UPDATE_FIELDS = [
  'customName',
  'platformId',
  'usageId',
  'groupId',
  'fromDomainIds',
  'fromAddressIds',
  'ipIds',
  'mailFromIds',
  'replyToIds',
  'trackingDomainIds',
  'hostingDomainIds',
  'linkDestinationDomainIds',
  'comments',
  'status',
  'qualityScore',
  'strategicScore',
  'sortOrder',
  'usesSharedIps',
];

/**
 * @api {get} /deliverability/audits/:auditId/mapping Get mapping for an audit
 * @apiPermission user
 * @apiName GetMapping
 * @apiGroup Deliverability/Mapping
 *
 * @apiParam {string} auditId Audit ID
 *
 * @apiSuccess {Object[]} groups List of mapping groups
 * @apiSuccess {Object[]} entries List of mapping entries (enriched with resolved inventory items)
 */
async function getMapping(req, res) {
  const { user, params } = req;
  const { auditId } = params;

  await auditService.checkIfUserIsAuthorizedToAccessAudit({ user, auditId });

  const { groups, entries } = await mappingService.findByAudit({ auditId });

  res.json({ groups, entries });
}

/**
 * @api {post} /deliverability/audits/:auditId/mapping/groups Create a mapping group
 * @apiPermission user
 * @apiName CreateMappingGroup
 * @apiGroup Deliverability/Mapping
 *
 * @apiParam {string} auditId Audit ID
 * @apiParam {string} name Group name
 *
 * @apiSuccess {Object} group Created group
 */
async function createGroup(req, res) {
  const { user, params, body } = req;
  const { auditId } = params;

  await auditService.checkIfUserIsAuthorizedToAccessAudit({ user, auditId });

  const group = await mappingService.createGroup({
    auditId,
    name: body.name,
  });

  res.status(201).json({ group });
}

/**
 * @api {put} /deliverability/audits/:auditId/mapping/groups/:groupId Update a mapping group
 * @apiPermission user
 * @apiName UpdateMappingGroup
 * @apiGroup Deliverability/Mapping
 *
 * @apiParam {string} auditId Audit ID
 * @apiParam {string} groupId Group ID
 *
 * @apiSuccess {Object} group Updated group
 */
async function updateGroup(req, res) {
  const { user, params, body } = req;
  const { auditId, groupId } = params;

  await auditService.checkIfUserIsAuthorizedToAccessAudit({ user, auditId });

  const data = pick(body, ALLOWED_GROUP_UPDATE_FIELDS);

  const group = await mappingService.updateGroup({ groupId, data });

  res.json({ group });
}

/**
 * @api {delete} /deliverability/audits/:auditId/mapping/groups/:groupId Delete a mapping group
 * @apiPermission user
 * @apiName DeleteMappingGroup
 * @apiGroup Deliverability/Mapping
 *
 * @apiParam {string} auditId Audit ID
 * @apiParam {string} groupId Group ID
 *
 * @apiSuccess {Object} message Success message
 */
async function deleteGroup(req, res) {
  const { user, params } = req;
  const { auditId, groupId } = params;

  await auditService.checkIfUserIsAuthorizedToAccessAudit({ user, auditId });

  await mappingService.deleteGroup({ groupId });

  res.json({ message: 'Mapping group deleted successfully' });
}

/**
 * @api {post} /deliverability/audits/:auditId/mapping/entries Create a mapping entry
 * @apiPermission user
 * @apiName CreateMappingEntry
 * @apiGroup Deliverability/Mapping
 *
 * @apiParam {string} auditId Audit ID
 * @apiParam {string} [groupId] Optional group ID to assign the entry to
 *
 * @apiSuccess {Object} entry Created entry
 */
async function createEntry(req, res) {
  const { user, params, body } = req;
  const { auditId } = params;

  await auditService.checkIfUserIsAuthorizedToAccessAudit({ user, auditId });

  const entry = await mappingService.createEntry({
    auditId,
    groupId: body.groupId || null,
  });

  res.status(201).json({ entry });
}

/**
 * @api {put} /deliverability/audits/:auditId/mapping/entries/:entryId Update a mapping entry
 * @apiPermission user
 * @apiName UpdateMappingEntry
 * @apiGroup Deliverability/Mapping
 *
 * @apiParam {string} auditId Audit ID
 * @apiParam {string} entryId Entry ID
 *
 * @apiSuccess {Object} entry Updated entry
 */
async function updateEntry(req, res) {
  const { user, params, body } = req;
  const { auditId, entryId } = params;

  await auditService.checkIfUserIsAuthorizedToAccessAudit({ user, auditId });

  const data = pick(body, ALLOWED_ENTRY_UPDATE_FIELDS);

  const entry = await mappingService.updateEntry({ entryId, data });

  res.json({ entry });
}

/**
 * @api {delete} /deliverability/audits/:auditId/mapping/entries/:entryId Delete a mapping entry
 * @apiPermission user
 * @apiName DeleteMappingEntry
 * @apiGroup Deliverability/Mapping
 *
 * @apiParam {string} auditId Audit ID
 * @apiParam {string} entryId Entry ID
 *
 * @apiSuccess {Object} message Success message
 */
async function deleteEntry(req, res) {
  const { user, params } = req;
  const { auditId, entryId } = params;

  await auditService.checkIfUserIsAuthorizedToAccessAudit({ user, auditId });

  await mappingService.deleteEntry({ entryId });

  res.json({ message: 'Mapping entry deleted successfully' });
}

/**
 * @api {post} /deliverability/audits/:auditId/mapping/reorder Reorder mapping entries
 * @apiPermission user
 * @apiName ReorderMappingEntries
 * @apiGroup Deliverability/Mapping
 *
 * @apiParam {string} auditId Audit ID
 * @apiParam {Object[]} updates Array of { id, sortOrder } pairs
 *
 * @apiSuccess {Object[]} entries Updated entries
 */
async function reorderEntries(req, res) {
  const { user, params, body } = req;
  const { auditId } = params;

  await auditService.checkIfUserIsAuthorizedToAccessAudit({ user, auditId });

  const entries = await mappingService.reorderEntries({
    auditId,
    updates: body.updates,
  });

  res.json({ entries });
}

async function reorderGroups(req, res) {
  const { user, params, body } = req;
  const { auditId } = params;
  await auditService.checkIfUserIsAuthorizedToAccessAudit({ user, auditId });
  await mappingService.reorderGroups({ auditId, updates: body.updates });
  res.json({ ok: true });
}
