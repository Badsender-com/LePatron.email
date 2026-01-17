'use strict';

const asyncHandler = require('express-async-handler');
const assetService = require('./asset.service.js');
const groupService = require('../group/group.service.js');
const ERROR_CODES = require('../constant/error-codes.js');
const { NotFound, Forbidden } = require('http-errors');

// Mask value for credentials - used to detect if password was changed
const CREDENTIAL_MASK = '••••••••';

module.exports = {
  createAsset: asyncHandler(createAsset),
  updateAsset: asyncHandler(updateAsset),
  deleteAsset: asyncHandler(deleteAsset),
  listAssets: asyncHandler(listAssets),
  getAsset: asyncHandler(getAsset),
  testConnection: asyncHandler(testConnection),
};

/**
 * @api {post} /groups/:groupId/assets Create asset
 * @apiPermission admin
 * @apiName CreateAsset
 * @apiGroup Assets
 *
 * @apiParam {string} groupId Group ID
 * @apiParam (Body) {String} name Asset name
 * @apiParam (Body) {String} type Asset type (sftp | s3)
 * @apiParam (Body) {Object} sftp SFTP configuration (if type is sftp)
 * @apiParam (Body) {Object} s3 S3 configuration (if type is s3)
 * @apiParam (Body) {String} publicEndpoint Public URL for accessing images
 * @apiParam (Body) {Boolean} isActive Whether asset is active
 *
 * @apiUse asset
 */
async function createAsset(req, res) {
  const { user, params, body } = req;
  const { groupId } = params;
  const { name, type, sftp, s3, publicEndpoint, isActive } = body;

  await checkAdminAccess(user, groupId);

  const asset = await assetService.createAsset({
    groupId,
    name,
    type,
    sftp,
    s3,
    publicEndpoint,
    isActive,
  });

  // Always mask credentials in response
  res.status(201).json(maskCredentials(asset));
}

/**
 * @api {put} /groups/:groupId/assets/:assetId Update asset
 * @apiPermission admin
 * @apiName UpdateAsset
 * @apiGroup Assets
 *
 * @apiParam {string} groupId Group ID
 * @apiParam {string} assetId Asset ID
 * @apiParam (Body) {String} name Asset name
 * @apiParam (Body) {Object} sftp SFTP configuration
 * @apiParam (Body) {Object} s3 S3 configuration
 * @apiParam (Body) {String} publicEndpoint Public URL
 * @apiParam (Body) {Boolean} isActive Whether asset is active
 *
 * @apiUse asset
 */
async function updateAsset(req, res) {
  const { user, params, body } = req;
  const { groupId, assetId } = params;
  const { name, sftp, s3, publicEndpoint, isActive } = body;

  await checkAdminAccess(user, groupId);

  // Filter out masked credential values - they should not be updated
  const cleanedSftp = sftp ? filterMaskedCredentials(sftp, ['password', 'sshKey']) : sftp;
  const cleanedS3 = s3 ? filterMaskedCredentials(s3, ['secretAccessKey']) : s3;

  const asset = await assetService.updateAsset({
    assetId,
    name,
    sftp: cleanedSftp,
    s3: cleanedS3,
    publicEndpoint,
    isActive,
  });

  // Always mask credentials in response
  res.json(maskCredentials(asset));
}

/**
 * @api {delete} /groups/:groupId/assets/:assetId Delete asset
 * @apiPermission admin
 * @apiName DeleteAsset
 * @apiGroup Assets
 *
 * @apiParam {string} groupId Group ID
 * @apiParam {string} assetId Asset ID
 */
async function deleteAsset(req, res) {
  const { user, params, query } = req;
  const { groupId, assetId } = params;
  const force = query.force === 'true';

  await checkAdminAccess(user, groupId);

  const result = await assetService.deleteAsset({ assetId, force });

  res.json(result);
}

/**
 * @api {get} /groups/:groupId/assets List assets
 * @apiPermission admin
 * @apiName ListAssets
 * @apiGroup Assets
 *
 * @apiParam {string} groupId Group ID
 * @apiQuery {Boolean} activeOnly Only return active assets
 *
 * @apiSuccess {Array} assets List of assets
 */
async function listAssets(req, res) {
  const { user, params, query } = req;
  const { groupId } = params;
  const activeOnly = query.activeOnly === 'true';

  await checkAdminAccess(user, groupId);

  let assets;
  if (activeOnly) {
    assets = await assetService.findActiveByGroup({ groupId });
  } else {
    assets = await assetService.findAllByGroup({ groupId });
  }

  // Always mask credentials in response
  const maskedAssets = assets.map(maskCredentials);
  res.json({ result: maskedAssets });
}

/**
 * @api {get} /groups/:groupId/assets/:assetId Get asset
 * @apiPermission admin
 * @apiName GetAsset
 * @apiGroup Assets
 *
 * @apiParam {string} groupId Group ID
 * @apiParam {string} assetId Asset ID
 *
 * @apiUse asset
 */
async function getAsset(req, res) {
  const { user, params } = req;
  const { groupId, assetId } = params;

  await checkAdminAccess(user, groupId);

  const asset = await assetService.findOne(assetId);

  // Mask sensitive credentials in response
  const maskedAsset = maskCredentials(asset);

  res.json({ result: maskedAsset });
}

/**
 * @api {post} /groups/:groupId/assets/test-connection Test asset connection
 * @apiPermission admin
 * @apiName TestAssetConnection
 * @apiGroup Assets
 *
 * @apiParam {string} groupId Group ID
 * @apiParam (Body) {String} assetId Existing asset ID to test
 * @apiParam (Body) {Object} assetData Asset configuration to test (if no assetId)
 *
 * @apiSuccess {Boolean} success Whether connection was successful
 * @apiSuccess {String} message Result message
 */
async function testConnection(req, res) {
  const { user, params, body } = req;
  const { groupId } = params;
  const { assetId, assetData } = body;

  await checkAdminAccess(user, groupId);

  const result = await assetService.testConnection({ assetId, assetData });

  res.json(result);
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

/**
 * Mask sensitive credentials in asset response
 * @param {Object} asset - Asset document or object
 * @returns {Object} Asset with masked credentials
 */
function maskCredentials(asset) {
  const assetObj = asset.toObject ? asset.toObject() : { ...asset };

  if (assetObj.sftp) {
    if (assetObj.sftp.password) {
      assetObj.sftp.password = CREDENTIAL_MASK;
    }
    if (assetObj.sftp.sshKey) {
      assetObj.sftp.sshKey = CREDENTIAL_MASK;
    }
  }

  if (assetObj.s3) {
    if (assetObj.s3.secretAccessKey) {
      assetObj.s3.secretAccessKey = CREDENTIAL_MASK;
    }
  }

  return assetObj;
}

/**
 * Filter out masked credential values from an object
 * If a credential field equals the mask value, remove it so it won't be updated
 * @param {Object} obj - Object containing potential credential fields
 * @param {Array<string>} fields - List of credential field names to check
 * @returns {Object} Object with masked credentials removed
 */
function filterMaskedCredentials(obj, fields) {
  if (!obj) return obj;

  const filtered = { ...obj };
  fields.forEach((field) => {
    if (filtered[field] === CREDENTIAL_MASK || filtered[field] === '') {
      delete filtered[field];
    }
  });
  return filtered;
}
