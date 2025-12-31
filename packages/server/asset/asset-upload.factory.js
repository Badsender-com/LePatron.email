'use strict';

const AssetTypes = require('../constant/asset-type.js');
const SftpUploadService = require('./upload-strategies/sftp-upload.service.js');
const S3UploadService = require('./upload-strategies/s3-upload.service.js');

/**
 * Factory to create the appropriate upload service based on asset type
 * @param {Object} asset - Asset document from database
 * @returns {SftpUploadService|S3UploadService} Upload service instance
 */
function createUploadService(asset) {
  if (!asset || !asset.type) {
    throw new Error('Asset type is required');
  }

  switch (asset.type) {
    case AssetTypes.SFTP:
      return new SftpUploadService(asset.sftp);

    case AssetTypes.S3:
      return new S3UploadService(asset.s3);

    default:
      throw new Error(`Unsupported asset type: ${asset.type}`);
  }
}

/**
 * Test connection for an asset
 * @param {Object} asset - Asset document or configuration
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function testAssetConnection(asset) {
  const service = createUploadService(asset);
  return service.testConnection();
}

/**
 * Upload files to an asset destination
 * @param {Object} asset - Asset document
 * @param {string[]} sourceUrls - Array of image URLs to upload
 * @param {string} folderName - Folder name for this upload
 * @returns {Promise<{success: boolean, uploadedFiles: string[], errors: string[]}>}
 */
async function uploadToAsset(asset, sourceUrls, folderName) {
  const service = createUploadService(asset);
  return service.upload(sourceUrls, folderName);
}

/**
 * Build the public URL for an uploaded file
 * @param {Object} asset - Asset document
 * @param {string} folderName - Folder name used during upload
 * @param {string} fileName - Name of the uploaded file
 * @returns {string} Full public URL
 */
function buildPublicUrl(asset, folderName, fileName) {
  let endpoint = asset.publicEndpoint;

  // Ensure endpoint ends with /
  if (!endpoint.endsWith('/')) {
    endpoint += '/';
  }

  return `${endpoint}${folderName}/${fileName}`;
}

module.exports = {
  createUploadService,
  testAssetConnection,
  uploadToAsset,
  buildPublicUrl,
};
