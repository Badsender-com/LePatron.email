'use strict';

const SftpClient = require('ssh2-sftp-client');
const fs = require('fs-extra');
const crypto = require('crypto');
const request = require('request');

const SftpAuthTypes = require('../../constant/sftp-auth-type.js');
const { getImageName } = require('../../utils/download-zip-markdown.js');
const logger = require('../../utils/logger.js');

class SftpUploadService {
  constructor(config) {
    this.config = config;
    this.client = new SftpClient();
  }

  /**
   * Build connection settings based on auth type
   */
  getConnectionSettings() {
    const { host, port, username, authType, password, sshKey } = this.config;

    const settings = {
      host,
      port: port || 22,
      username,
      keepaliveInterval: 2000,
      keepaliveCountMax: 50,
    };

    if (authType === SftpAuthTypes.SSH_KEY && sshKey) {
      settings.privateKey = sshKey;
    } else {
      settings.password = password;
    }

    return settings;
  }

  /**
   * Test connection to SFTP server
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async testConnection() {
    try {
      const settings = this.getConnectionSettings();
      // Debug: log key info (first/last chars only for security)
      if (settings.privateKey) {
        const key = settings.privateKey;
        logger.log(`SSH Key debug: length=${key.length}, starts="${key.substring(0, 40)}...", ends="...${key.substring(key.length - 30)}"`);
      }
      await this.client.connect(settings);

      const { pathOnServer } = this.config;
      const exists = await this.client.exists(pathOnServer || './');

      await this.client.end();

      if (exists) {
        return { success: true, message: 'Connection successful' };
      } else {
        return {
          success: false,
          message: `Path "${pathOnServer}" does not exist on server`,
        };
      }
    } catch (error) {
      logger.error('SFTP connection test failed:', error);
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
      };
    }
  }

  /**
   * Upload multiple files to SFTP server
   * @param {string[]} sourceUrls - Array of image URLs to upload
   * @param {string} folderName - Folder name for this upload (usually mailing name)
   * @returns {Promise<{success: boolean, uploadedFiles: string[], errors: string[]}>}
   */
  async upload(sourceUrls, folderName) {
    const tmpDir = this.createTempDir();
    const uploadedFiles = [];
    const errors = [];

    try {
      const settings = this.getConnectionSettings();
      await this.client.connect(settings);

      const { pathOnServer } = this.config;
      const basePath = this.normalizePath(pathOnServer);
      const folderPath = `${basePath}${folderName}/`;

      // Create folder if it doesn't exist
      const exists = await this.client.exists(folderPath);
      if (!exists) {
        await this.client.mkdir(folderPath, { recursive: true });
      }

      // Download and upload each file
      for (const fileUrl of sourceUrls) {
        try {
          const fileName = getImageName(fileUrl);
          const localPath = `${tmpDir}/${fileName}`;
          const remotePath = `${folderPath}${fileName}`;

          // Download file locally
          await this.downloadFile(fileUrl, localPath);

          // Upload to SFTP
          await this.client.fastPut(localPath, remotePath, { chunkSize: 16384 });
          uploadedFiles.push(fileName);
          logger.log(`SFTP upload success: ${fileName}`);
        } catch (error) {
          logger.error(`SFTP upload failed for ${fileUrl}:`, error);
          errors.push(`${fileUrl}: ${error.message}`);
        }
      }

      return { success: errors.length === 0, uploadedFiles, errors };
    } catch (error) {
      logger.error('SFTP upload session failed:', error);
      return {
        success: false,
        uploadedFiles,
        errors: [...errors, `Session error: ${error.message}`],
      };
    } finally {
      // Cleanup
      fs.removeSync(tmpDir);
      try {
        await this.client.end();
      } catch (err) {
        logger.warn('Error closing SFTP client:', err);
      }
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
    const tmpDir = `/tmp/sftp-upload-${hash}`;
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
   * Normalize path to ensure it ends with /
   */
  normalizePath(path) {
    if (!path) return './';
    return path.endsWith('/') ? path : `${path}/`;
  }
}

module.exports = SftpUploadService;
