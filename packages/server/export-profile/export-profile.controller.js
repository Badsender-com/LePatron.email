'use strict';

const asyncHandler = require('express-async-handler');
const exportProfileService = require('./export-profile.service.js');
const groupService = require('../group/group.service.js');
const ERROR_CODES = require('../constant/error-codes.js');
const { Forbidden } = require('http-errors');

module.exports = {
  createExportProfile: asyncHandler(createExportProfile),
  updateExportProfile: asyncHandler(updateExportProfile),
  deleteExportProfile: asyncHandler(deleteExportProfile),
  listExportProfiles: asyncHandler(listExportProfiles),
  getExportProfile: asyncHandler(getExportProfile),
};

/**
 * @api {post} /groups/:groupId/export-profiles Create export profile
 * @apiPermission admin
 * @apiName CreateExportProfile
 * @apiGroup ExportProfiles
 *
 * @apiParam {string} groupId Group ID
 * @apiParam (Body) {String} name Export profile name
 * @apiParam (Body) {String} deliveryMethod Delivery method (esp | download)
 * @apiParam (Body) {String} espProfileId ESP Profile ID (required if deliveryMethod is esp)
 * @apiParam (Body) {String} assetMethod Asset method (asset | zip | esp_api)
 * @apiParam (Body) {String} assetId Asset ID (required if assetMethod is asset)
 * @apiParam (Body) {Boolean} isActive Whether profile is active
 *
 * @apiUse exportProfile
 */
async function createExportProfile(req, res) {
  const { user, params, body } = req;
  const { groupId } = params;
  const { name, deliveryMethod, espProfileId, assetMethod, assetId, isActive } = body;

  await checkAdminAccess(user, groupId);

  const exportProfile = await exportProfileService.createExportProfile({
    groupId,
    name,
    deliveryMethod,
    espProfileId,
    assetMethod,
    assetId,
    isActive,
  });

  res.status(201).json(exportProfile);
}

/**
 * @api {put} /groups/:groupId/export-profiles/:exportProfileId Update export profile
 * @apiPermission admin
 * @apiName UpdateExportProfile
 * @apiGroup ExportProfiles
 *
 * @apiParam {string} groupId Group ID
 * @apiParam {string} exportProfileId Export Profile ID
 * @apiParam (Body) {String} name Export profile name
 * @apiParam (Body) {String} deliveryMethod Delivery method (esp | download)
 * @apiParam (Body) {String} espProfileId ESP Profile ID
 * @apiParam (Body) {String} assetMethod Asset method (asset | zip | esp_api)
 * @apiParam (Body) {String} assetId Asset ID
 * @apiParam (Body) {Boolean} isActive Whether profile is active
 *
 * @apiUse exportProfile
 */
async function updateExportProfile(req, res) {
  const { user, params, body } = req;
  const { groupId, exportProfileId } = params;
  const { name, deliveryMethod, espProfileId, assetMethod, assetId, isActive } = body;

  await checkAdminAccess(user, groupId);

  const exportProfile = await exportProfileService.updateExportProfile({
    exportProfileId,
    name,
    deliveryMethod,
    espProfileId,
    assetMethod,
    assetId,
    isActive,
  });

  res.json(exportProfile);
}

/**
 * @api {delete} /groups/:groupId/export-profiles/:exportProfileId Delete export profile
 * @apiPermission admin
 * @apiName DeleteExportProfile
 * @apiGroup ExportProfiles
 *
 * @apiParam {string} groupId Group ID
 * @apiParam {string} exportProfileId Export Profile ID
 */
async function deleteExportProfile(req, res) {
  const { user, params } = req;
  const { groupId, exportProfileId } = params;

  await checkAdminAccess(user, groupId);

  const result = await exportProfileService.deleteExportProfile({ exportProfileId });

  res.json(result);
}

/**
 * @api {get} /groups/:groupId/export-profiles List export profiles
 * @apiPermission admin
 * @apiName ListExportProfiles
 * @apiGroup ExportProfiles
 *
 * @apiParam {string} groupId Group ID
 * @apiQuery {Boolean} activeOnly Only return active export profiles
 *
 * @apiSuccess {Array} result List of export profiles
 */
async function listExportProfiles(req, res) {
  const { user, params, query } = req;
  const { groupId } = params;
  const activeOnly = query.activeOnly === 'true';

  await checkAdminAccess(user, groupId);

  let exportProfiles;
  if (activeOnly) {
    exportProfiles = await exportProfileService.findActiveByGroup({ groupId });
  } else {
    exportProfiles = await exportProfileService.findAllByGroup({ groupId });
  }

  res.json({ result: exportProfiles });
}

/**
 * @api {get} /groups/:groupId/export-profiles/:exportProfileId Get export profile
 * @apiPermission admin
 * @apiName GetExportProfile
 * @apiGroup ExportProfiles
 *
 * @apiParam {string} groupId Group ID
 * @apiParam {string} exportProfileId Export Profile ID
 *
 * @apiUse exportProfile
 */
async function getExportProfile(req, res) {
  const { user, params } = req;
  const { groupId, exportProfileId } = params;

  await checkAdminAccess(user, groupId);

  const exportProfile = await exportProfileService.findOne(exportProfileId);

  res.json({ result: exportProfile });
}

/**
 * Check if user has admin access to group
 */
async function checkAdminAccess(user, groupId) {
  if (!user.isAdmin) {
    throw new Forbidden(ERROR_CODES.FORBIDDEN_RESOURCE_OR_ACTION);
  }
  await groupService.findById(groupId);
}
