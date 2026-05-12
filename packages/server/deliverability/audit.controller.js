'use strict';

const asyncHandler = require('express-async-handler');
const { pick } = require('lodash');
const auditService = require('./audit.service');
const { Groups } = require('../common/models.common.js');
const createError = require('http-errors');
const ERROR_CODES = require('../constant/error-codes.js');

module.exports = {
  list: asyncHandler(list),
  create: asyncHandler(create),
  read: asyncHandler(read),
  update: asyncHandler(update),
  delete: asyncHandler(deleteAudit),
};

/**
 * @api {get} /deliverability/groups/:groupId/audits List audits for a company
 * @apiPermission group_admin
 * @apiName ListAudits
 * @apiGroup Deliverability
 *
 * @apiParam {string} groupId Company/Group ID
 *
 * @apiSuccess {Object[]} audits List of audits
 */
async function list(req, res) {
  const { user, params } = req;
  const { groupId } = params;

  // Get user's group ID - can be a string, ObjectId, or object with id/_id
  const userGroupId =
    typeof user.group === 'string'
      ? user.group
      : user.group.id || user.group._id || user.group.toString();

  // Verify user has access to this group
  if (!user.isAdmin && userGroupId !== groupId) {
    throw createError.Forbidden(ERROR_CODES.UNAUTHORIZED_ACCESS);
  }

  // Verify group exists and has deliverability enabled
  const group = await Groups.findById(groupId);
  if (!group) {
    throw createError.NotFound(ERROR_CODES.GROUP_NOT_FOUND);
  }

  if (!group.enableDeliverability) {
    throw createError.Forbidden(
      'Deliverability module is not enabled for this company'
    );
  }

  const audits = await auditService.findByGroup({ groupId });
  res.json({ audits });
}

/**
 * @api {post} /deliverability/groups/:groupId/audits Create a new audit
 * @apiPermission group_admin
 * @apiName CreateAudit
 * @apiGroup Deliverability
 *
 * @apiParam {string} groupId Company/Group ID
 * @apiParam {string} name Audit name
 * @apiParam {string} [status] Audit status (default: DRAFT)
 *
 * @apiSuccess {Object} audit Created audit
 */
async function create(req, res) {
  const { user, params, body } = req;
  const { groupId } = params;

  // Get user's group ID - can be a string, ObjectId, or object with id/_id
  const userGroupId =
    typeof user.group === 'string'
      ? user.group
      : user.group.id || user.group._id || user.group.toString();

  // Verify user has access to this group
  if (!user.isAdmin && userGroupId !== groupId) {
    throw createError.Forbidden(ERROR_CODES.UNAUTHORIZED_ACCESS);
  }

  // Get user ID - can be _id (MongoDB) or id
  const userId = user._id
    ? user._id.toString()
    : user.id
    ? user.id.toString()
    : null;
  if (!userId) {
    console.error('[audit.controller] User has no _id or id:', user);
    throw createError.BadRequest('User ID is missing');
  }

  const auditData = {
    ...pick(body, ['name', 'status']),
    companyId: groupId,
    userId,
  };

  console.log('[audit.controller] Creating audit with data:', auditData);
  const audit = await auditService.createAudit(auditData);
  console.log('[audit.controller] Audit created:', audit);

  if (!audit) {
    console.error('[audit.controller] Service returned undefined audit');
    throw createError.InternalServerError('Failed to create audit');
  }

  res.status(201).json({ audit });
}

/**
 * @api {get} /deliverability/audits/:auditId Get audit details
 * @apiPermission user
 * @apiName GetAudit
 * @apiGroup Deliverability
 *
 * @apiParam {string} auditId Audit ID
 *
 * @apiSuccess {Object} audit Audit details
 */
async function read(req, res) {
  const { user, params } = req;
  const { auditId } = params;

  const audit = await auditService.checkIfUserIsAuthorizedToAccessAudit({
    user,
    auditId,
  });

  res.json({ audit });
}

/**
 * @api {put} /deliverability/audits/:auditId Update audit
 * @apiPermission group_admin
 * @apiName UpdateAudit
 * @apiGroup Deliverability
 *
 * @apiParam {string} auditId Audit ID
 * @apiParam {string} [name] Audit name
 * @apiParam {string} [status] Audit status
 * @apiParam {boolean} [workshopReady] Workshop ready flag
 *
 * @apiSuccess {Object} audit Updated audit
 */
async function update(req, res) {
  const { user, params, body } = req;
  const { auditId } = params;

  // Check authorization
  await auditService.checkIfUserIsAuthorizedToAccessAudit({ user, auditId });

  const updateData = pick(body, ['name', 'status', 'workshopReady']);

  const audit = await auditService.updateAudit({
    auditId,
    data: updateData,
  });

  res.json({ audit });
}

/**
 * @api {delete} /deliverability/audits/:auditId Delete audit
 * @apiPermission group_admin
 * @apiName DeleteAudit
 * @apiGroup Deliverability
 *
 * @apiParam {string} auditId Audit ID
 *
 * @apiSuccess {Object} message Success message
 */
async function deleteAudit(req, res) {
  const { user, params } = req;
  const { auditId } = params;

  // Check authorization
  await auditService.checkIfUserIsAuthorizedToAccessAudit({ user, auditId });

  await auditService.deleteAudit({ auditId });

  res.json({ message: 'Audit deleted successfully' });
}
