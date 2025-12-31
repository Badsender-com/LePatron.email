'use strict';

const AWS = require('aws-sdk');
const fs = require('fs-extra');
const crypto = require('crypto');
const request = require('request');
const path = require('path');

const { getImageName } = require('../../utils/download-zip-markdown.js');
const logger = require('../../utils/logger.js');

class S3UploadService {
  constructor(config) {
    this.config = config;
    this.s3Client = this.createS3Client();
  }

  /**
   * Create S3 client with configuration
   */
  createS3Client() {
    const { endpoint, region, accessKeyId, secretAccessKey, forcePathStyle } =
      this.config;

    const s3Config = {
      accessKeyId,
      secretAccessKey,
      region: region || 'us-east-1',
      s3ForcePathStyle: forcePathStyle || false,
    };

    // Custom endpoint for S3-compatible services (Infomaniak, Scaleway, etc.)
    if (endpoint) {
      s3Config.endpoint = new AWS.Endpoint(endpoint);
    }

    return new AWS.S3(s3Config);
  }

  /**
   * Test connection to S3 bucket
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async testConnection() {
    try {
      const { bucket } = this.config;

      // Try to head the bucket to check access
      await this.s3Client.headBucket({ Bucket: bucket }).promise();

      return { success: true, message: 'Connection successful' };
    } catch (error) {
      logger.error('S3 connection test failed:', error);

      let message = `Connection failed: ${error.message}`;
      if (error.code === 'NotFound') {
        message = `Bucket "${this.config.bucket}" not found`;
      } else if (error.code === 'Forbidden') {
        message = 'Access denied. Check your credentials and bucket permissions.';
      } else if (error.code === 'InvalidAccessKeyId') {
        message = 'Invalid Access Key ID';
      } else if (error.code === 'SignatureDoesNotMatch') {
        message = 'Invalid Secret Access Key';
      }

      return { success: false, message };
    }
  }

  /**
   * Upload multiple files to S3 bucket
   * @param {string[]} sourceUrls - Array of image URLs to upload
   * @param {string} folderName - Folder name for this upload (usually mailing name)
   * @returns {Promise<{success: boolean, uploadedFiles: string[], errors: string[]}>}
   */
  async upload(sourceUrls, folderName) {
    const tmpDir = this.createTempDir();
    const uploadedFiles = [];
    const errors = [];

    try {
      const { bucket, pathPrefix } = this.config;
      const basePath = this.normalizePath(pathPrefix);
      const folderPath = `${basePath}${folderName}/`;

      // Upload each file
      const uploadPromises = sourceUrls.map(async (fileUrl) => {
        try {
          const fileName = getImageName(fileUrl);
          const localPath = `${tmpDir}/${fileName}`;
          const s3Key = `${folderPath}${fileName}`;

          // Download file locally
          await this.downloadFile(fileUrl, localPath);

          // Get content type
          const contentType = this.getContentType(fileName);

          // Read file and upload to S3
          const fileContent = fs.readFileSync(localPath);

          await this.s3Client
            .putObject({
              Bucket: bucket,
              Key: s3Key,
              Body: fileContent,
              ContentType: contentType,
            })
            .promise();

          uploadedFiles.push(fileName);
          logger.log(`S3 upload success: ${fileName}`);
        } catch (error) {
          logger.error(`S3 upload failed for ${fileUrl}:`, error);
          errors.push(`${fileUrl}: ${error.message}`);
        }
      });

      await Promise.all(uploadPromises);

      return { success: errors.length === 0, uploadedFiles, errors };
    } catch (error) {
      logger.error('S3 upload session failed:', error);
      return {
        success: false,
        uploadedFiles,
        errors: [...errors, `Session error: ${error.message}`],
      };
    } finally {
      // Cleanup
      fs.removeSync(tmpDir);
    }
  }

  /**
   * Create a temporary directory for downloads
   */
  createTempDir() {
    const currentDate = new Date().valueOf().toString();
    const random = Math.random().toString();
    const hash = crypto
      .createHash('sha1')
      .update(currentDate + random)
      .digest('hex');
    const tmpDir = `/tmp/s3-upload-${hash}`;
    fs.mkdirSync(tmpDir);
    return tmpDir;
  }

  /**
   * Download a file from URL to local path
   */
  downloadFile(url, localPath) {
    return new Promise((resolve, reject) => {
      const fileStream = fs.createWriteStream(localPath);
      const requestedFile = request.get(url);

      requestedFile.pipe(fileStream);
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
      requestedFile.on('error', reject);
    });
  }

  /**
   * Normalize path prefix
   */
  normalizePath(pathPrefix) {
    if (!pathPrefix) return '';
    // Remove leading slash, ensure trailing slash
    let normalized = pathPrefix.replace(/^\/+/, '');
    if (normalized && !normalized.endsWith('/')) {
      normalized += '/';
    }
    return normalized;
  }

  /**
   * Get content type based on file extension
   */
  getContentType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };
    return contentTypes[ext] || 'application/octet-stream';
  }
}

module.exports = S3UploadService;
