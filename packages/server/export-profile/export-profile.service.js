'use strict';

const { Types } = require('mongoose');
const { NotFound, Conflict, BadRequest } = require('http-errors');

const { ExportProfiles, Assets, Profiles } = require('../common/models.common.js');
const ERROR_CODES = require('../constant/error-codes.js');
const DeliveryMethods = require('../constant/delivery-method.js');
const AssetMethods = require('../constant/asset-method.js');
const groupService = require('../group/group.service.js');

module.exports = {
  createExportProfile,
  updateExportProfile,
  findAllByGroup,
  findActiveByGroup,
  findOne,
  deleteExportProfile,
  checkExportProfileExists,
  validateExportProfileConfig,
};

/**
 * Create a new export profile
 */
async function createExportProfile({
  groupId,
  name,
  deliveryMethod,
  espProfileId,
  assetMethod,
  assetId,
  isActive = true,
}) {
  // Validate group exists
  await groupService.findById(groupId);

  // Check for duplicate name within group
  const existingProfile = await ExportProfiles.findOne({ _company: groupId, name });
  if (existingProfile) {
    throw new Conflict(ERROR_CODES.EXPORT_PROFILE_NAME_ALREADY_EXISTS);
  }

  // Validate configuration
  await validateExportProfileConfig({
    groupId,
    deliveryMethod,
    espProfileId,
    assetMethod,
    assetId,
  });

  const profileData = {
    name,
    _company: groupId,
    deliveryMethod,
    assetMethod,
    isActive,
  };

  // Set references if applicable
  if (deliveryMethod === DeliveryMethods.ESP && espProfileId) {
    profileData._espProfile = espProfileId;
  }

  if (assetMethod === AssetMethods.ASSET && assetId) {
    profileData._asset = assetId;
  }

  return ExportProfiles.create(profileData);
}

/**
 * Update an existing export profile
 */
async function updateExportProfile({
  exportProfileId,
  name,
  deliveryMethod,
  espProfileId,
  assetMethod,
  assetId,
  isActive,
}) {
  const profile = await findOne(exportProfileId);

  // Check for duplicate name if name is being changed
  if (name && name !== profile.name) {
    const existingProfile = await ExportProfiles.findOne({
      _company: profile._company,
      name,
      _id: { $ne: Types.ObjectId(exportProfileId) },
    });
    if (existingProfile) {
      throw new Conflict(ERROR_CODES.EXPORT_PROFILE_NAME_ALREADY_EXISTS);
    }
  }

  // Build update data
  const updateData = {};

  if (name !== undefined) updateData.name = name;
  if (isActive !== undefined) updateData.isActive = isActive;

  // Handle delivery method and ESP profile
  if (deliveryMethod !== undefined) {
    updateData.deliveryMethod = deliveryMethod;

    if (deliveryMethod === DeliveryMethods.ESP) {
      // Validate and set ESP profile
      const espId = espProfileId !== undefined ? espProfileId : profile._espProfile;
      if (espId) {
        await validateEspProfile(profile._company, espId);
        updateData._espProfile = espId;
      }
    } else {
      // Clear ESP profile if switching to download
      updateData._espProfile = null;
    }
  } else if (espProfileId !== undefined) {
    // Updating ESP profile without changing delivery method
    if (profile.deliveryMethod === DeliveryMethods.ESP && espProfileId) {
      await validateEspProfile(profile._company, espProfileId);
      updateData._espProfile = espProfileId;
    }
  }

  // Handle asset method and asset reference
  if (assetMethod !== undefined) {
    updateData.assetMethod = assetMethod;

    if (assetMethod === AssetMethods.ASSET) {
      // Validate and set asset
      const assetRefId = assetId !== undefined ? assetId : profile._asset;
      if (assetRefId) {
        await validateAsset(profile._company, assetRefId);
        updateData._asset = assetRefId;
      }
    } else {
      // Clear asset if switching to zip or esp_api
      updateData._asset = null;
    }

    // Validate esp_api requires esp delivery method
    if (assetMethod === AssetMethods.ESP_API) {
      const effectiveDeliveryMethod = deliveryMethod || profile.deliveryMethod;
      if (effectiveDeliveryMethod !== DeliveryMethods.ESP) {
        throw new BadRequest(ERROR_CODES.EXPORT_PROFILE_INVALID_CONFIG);
      }
    }
  } else if (assetId !== undefined) {
    // Updating asset without changing asset method
    if (profile.assetMethod === AssetMethods.ASSET && assetId) {
      await validateAsset(profile._company, assetId);
      updateData._asset = assetId;
    }
  }

  await ExportProfiles.updateOne(
    { _id: Types.ObjectId(exportProfileId) },
    { $set: updateData }
  );

  return findOne(exportProfileId);
}

/**
 * Find all export profiles for a group
 */
async function findAllByGroup({ groupId }) {
  await groupService.findById(groupId);
  return ExportProfiles.find({ _company: groupId })
    .populate('_espProfile', 'name type')
    .populate('_asset', 'name type')
    .sort({ name: 1 });
}

/**
 * Find active export profiles for a group (for dropdowns)
 */
async function findActiveByGroup({ groupId }) {
  await groupService.findById(groupId);
  return ExportProfiles.find({ _company: groupId, isActive: true })
    .populate('_espProfile', 'name type')
    .populate('_asset', 'name type publicEndpoint')
    .sort({ name: 1 });
}

/**
 * Find one export profile by ID
 */
async function findOne(exportProfileId) {
  await checkExportProfileExists(exportProfileId);
  return ExportProfiles.findOne({ _id: Types.ObjectId(exportProfileId) })
    .populate('_espProfile', 'name type')
    .populate('_asset', 'name type publicEndpoint');
}

/**
 * Check if export profile exists
 */
async function checkExportProfileExists(exportProfileId) {
  if (!(await ExportProfiles.exists({ _id: Types.ObjectId(exportProfileId) }))) {
    throw new NotFound(ERROR_CODES.EXPORT_PROFILE_NOT_FOUND);
  }
}

/**
 * Delete an export profile
 */
async function deleteExportProfile({ exportProfileId }) {
  await checkExportProfileExists(exportProfileId);

  const result = await ExportProfiles.deleteOne({ _id: Types.ObjectId(exportProfileId) });

  if (result.deletedCount !== 1) {
    throw new Error(ERROR_CODES.FAILED_EXPORT_PROFILE_DELETE);
  }

  return { success: true, deletedId: exportProfileId };
}

/**
 * Validate export profile configuration
 */
async function validateExportProfileConfig({
  groupId,
  deliveryMethod,
  espProfileId,
  assetMethod,
  assetId,
}) {
  // Validate delivery method
  if (!deliveryMethod || ![DeliveryMethods.ESP, DeliveryMethods.DOWNLOAD].includes(deliveryMethod)) {
    throw new BadRequest(ERROR_CODES.EXPORT_PROFILE_INVALID_CONFIG);
  }

  // Validate asset method
  if (!assetMethod || ![AssetMethods.ASSET, AssetMethods.ZIP, AssetMethods.ESP_API].includes(assetMethod)) {
    throw new BadRequest(ERROR_CODES.EXPORT_PROFILE_INVALID_CONFIG);
  }

  // If delivery method is ESP, validate ESP profile
  if (deliveryMethod === DeliveryMethods.ESP) {
    if (!espProfileId) {
      throw new BadRequest(ERROR_CODES.EXPORT_PROFILE_INVALID_CONFIG);
    }
    await validateEspProfile(groupId, espProfileId);
  }

  // If asset method is 'asset', validate asset reference
  if (assetMethod === AssetMethods.ASSET) {
    if (!assetId) {
      throw new BadRequest(ERROR_CODES.EXPORT_PROFILE_INVALID_CONFIG);
    }
    await validateAsset(groupId, assetId);
  }

  // If asset method is 'esp_api', delivery method must be 'esp'
  if (assetMethod === AssetMethods.ESP_API && deliveryMethod !== DeliveryMethods.ESP) {
    throw new BadRequest(ERROR_CODES.EXPORT_PROFILE_INVALID_CONFIG);
  }

  return true;
}

/**
 * Validate ESP profile exists and belongs to the group
 */
async function validateEspProfile(groupId, espProfileId) {
  const espProfile = await Profiles.findOne({
    _id: Types.ObjectId(espProfileId),
    _company: groupId,
  });

  if (!espProfile) {
    throw new NotFound(ERROR_CODES.PROFILE_NOT_FOUND);
  }

  return espProfile;
}

/**
 * Validate asset exists and belongs to the group
 */
async function validateAsset(groupId, assetId) {
  const asset = await Assets.findOne({
    _id: Types.ObjectId(assetId),
    _company: groupId,
  });

  if (!asset) {
    throw new NotFound(ERROR_CODES.ASSET_NOT_FOUND);
  }

  return asset;
}
