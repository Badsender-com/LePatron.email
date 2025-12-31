'use strict';

const { Types } = require('mongoose');
const { NotFound, Conflict, BadRequest, InternalServerError } = require('http-errors');

const { Assets, ExportProfiles } = require('../common/models.common.js');
const ERROR_CODES = require('../constant/error-codes.js');
const AssetTypes = require('../constant/asset-type.js');
const { testAssetConnection } = require('./asset-upload.factory.js');
const groupService = require('../group/group.service.js');

module.exports = {
  createAsset,
  updateAsset,
  findAllByGroup,
  findOne,
  deleteAsset,
  testConnection,
  findActiveByGroup,
  checkAssetExists,
  findExportProfilesUsingAsset,
};

/**
 * Create a new asset
 */
async function createAsset({ groupId, name, type, sftp, s3, publicEndpoint, isActive = true }) {
  // Validate group exists
  await groupService.findById(groupId);

  // Validate asset type
  if (!type || ![AssetTypes.SFTP, AssetTypes.S3].includes(type)) {
    throw new BadRequest(ERROR_CODES.ASSET_INVALID_TYPE);
  }

  // Check for duplicate name within group
  const existingAsset = await Assets.findOne({ _company: groupId, name });
  if (existingAsset) {
    throw new Conflict(ERROR_CODES.ASSET_NAME_ALREADY_EXISTS);
  }

  const assetData = {
    name,
    _company: groupId,
    type,
    publicEndpoint,
    isActive,
  };

  // Add type-specific configuration
  if (type === AssetTypes.SFTP) {
    assetData.sftp = sftp || {};
  } else if (type === AssetTypes.S3) {
    assetData.s3 = s3 || {};
  }

  return Assets.create(assetData);
}

/**
 * Update an existing asset
 */
async function updateAsset({ assetId, name, sftp, s3, publicEndpoint, isActive }) {
  const asset = await findOne(assetId);

  // Check for duplicate name if name is being changed
  if (name && name !== asset.name) {
    const existingAsset = await Assets.findOne({
      _company: asset._company,
      name,
      _id: { $ne: Types.ObjectId(assetId) },
    });
    if (existingAsset) {
      throw new Conflict(ERROR_CODES.ASSET_NAME_ALREADY_EXISTS);
    }
  }

  const updateData = {};

  if (name !== undefined) updateData.name = name;
  if (publicEndpoint !== undefined) updateData.publicEndpoint = publicEndpoint;
  if (isActive !== undefined) updateData.isActive = isActive;

  // Update type-specific configuration
  if (asset.type === AssetTypes.SFTP && sftp) {
    // Merge SFTP config, preserving existing password/sshKey if not provided
    updateData.sftp = {
      ...asset.sftp.toObject(),
      ...sftp,
    };
    // Keep existing credentials if empty string provided
    if (!sftp.password && asset.sftp.password) {
      updateData.sftp.password = asset.sftp.password;
    }
    if (!sftp.sshKey && asset.sftp.sshKey) {
      updateData.sftp.sshKey = asset.sftp.sshKey;
    }
  } else if (asset.type === AssetTypes.S3 && s3) {
    // Merge S3 config, preserving existing secretAccessKey if not provided
    updateData.s3 = {
      ...asset.s3.toObject(),
      ...s3,
    };
    if (!s3.secretAccessKey && asset.s3.secretAccessKey) {
      updateData.s3.secretAccessKey = asset.s3.secretAccessKey;
    }
  }

  const result = await Assets.updateOne(
    { _id: Types.ObjectId(assetId) },
    { $set: updateData }
  );

  if (result.modifiedCount === 0 && result.matchedCount === 0) {
    throw new InternalServerError(ERROR_CODES.FAILED_ASSET_UPDATE);
  }

  return findOne(assetId);
}

/**
 * Find all assets for a group
 */
async function findAllByGroup({ groupId }) {
  await groupService.findById(groupId);
  return Assets.find({ _company: groupId }).sort({ name: 1 });
}

/**
 * Find active assets for a group (for dropdowns)
 */
async function findActiveByGroup({ groupId }) {
  await groupService.findById(groupId);
  return Assets.find({ _company: groupId, isActive: true }).sort({ name: 1 });
}

/**
 * Find one asset by ID
 */
async function findOne(assetId) {
  await checkAssetExists(assetId);
  return Assets.findOne({ _id: Types.ObjectId(assetId) });
}

/**
 * Check if asset exists
 */
async function checkAssetExists(assetId) {
  if (!(await Assets.exists({ _id: Types.ObjectId(assetId) }))) {
    throw new NotFound(ERROR_CODES.ASSET_NOT_FOUND);
  }
}

/**
 * Delete an asset
 * @param {string} assetId - Asset ID to delete
 * @param {boolean} force - Force delete even if in use (default: false)
 */
async function deleteAsset({ assetId, force = false }) {
  const asset = await findOne(assetId);

  // Check if asset is used by any ExportProfile
  if (!force) {
    const exportProfiles = await findExportProfilesUsingAsset(assetId);
    if (exportProfiles.length > 0) {
      const error = new Conflict(ERROR_CODES.ASSET_IN_USE);
      error.exportProfiles = exportProfiles.map((p) => ({ id: p._id, name: p.name }));
      throw error;
    }
  }

  const result = await Assets.deleteOne({ _id: Types.ObjectId(assetId) });

  if (result.deletedCount !== 1) {
    throw new InternalServerError(ERROR_CODES.FAILED_ASSET_DELETE);
  }

  return { success: true, deletedId: assetId };
}

/**
 * Find all ExportProfiles that use a specific asset
 * @param {string} assetId - Asset ID to check
 * @returns {Promise<Array>} List of ExportProfiles using this asset
 */
async function findExportProfilesUsingAsset(assetId) {
  return ExportProfiles.find({ _asset: Types.ObjectId(assetId) }).select('name');
}

/**
 * Test connection to an asset
 */
async function testConnection({ assetId, assetData }) {
  let asset;

  if (assetId) {
    // Test existing asset
    asset = await findOne(assetId);
  } else if (assetData) {
    // Test with provided data (for testing before save)
    asset = assetData;
  } else {
    throw new BadRequest('Either assetId or assetData is required');
  }

  try {
    const result = await testAssetConnection(asset);
    return result;
  } catch (error) {
    return {
      success: false,
      message: error.message || 'Connection test failed',
    };
  }
}
