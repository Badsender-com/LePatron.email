'use strict';

// Mock dependencies
jest.mock('ssh2-sftp-client');
jest.mock('fs-extra');
jest.mock('request');
jest.mock('../../utils/logger.js', () => ({
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));
jest.mock('../../utils/download-zip-markdown.js', () => ({
  getImageName: jest.fn((url) => {
    const parts = url.split('/');
    return parts[parts.length - 1];
  }),
}));

const SftpClient = require('ssh2-sftp-client');
const fs = require('fs-extra');
const request = require('request');
const SftpAuthTypes = require('../../constant/sftp-auth-type.js');
const SftpUploadService = require('./sftp-upload.service.js');

describe('SftpUploadService', () => {
  let service;
  let mockClient;

  const defaultConfig = {
    host: 'sftp.example.com',
    port: 22,
    username: 'testuser',
    authType: SftpAuthTypes.PASSWORD,
    password: 'testpassword',
    sshKey: '',
    pathOnServer: '/uploads',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      end: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(true),
      mkdir: jest.fn().mockResolvedValue(undefined),
      fastPut: jest.fn().mockResolvedValue(undefined),
    };

    SftpClient.mockImplementation(() => mockClient);

    fs.mkdirSync = jest.fn();
    fs.removeSync = jest.fn();
    fs.createWriteStream = jest.fn();
  });

  describe('constructor', () => {
    it('should create service with config', () => {
      service = new SftpUploadService(defaultConfig);

      expect(service.config).toEqual(defaultConfig);
      expect(SftpClient).toHaveBeenCalled();
    });
  });

  describe('getConnectionSettings', () => {
    it('should return password-based settings', () => {
      service = new SftpUploadService(defaultConfig);

      const settings = service.getConnectionSettings();

      expect(settings).toEqual({
        host: 'sftp.example.com',
        port: 22,
        username: 'testuser',
        password: 'testpassword',
        keepaliveInterval: 2000,
        keepaliveCountMax: 50,
      });
    });

    it('should return SSH key-based settings', () => {
      const sshKeyConfig = {
        ...defaultConfig,
        authType: SftpAuthTypes.SSH_KEY,
        sshKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIE...',
        password: '',
      };
      service = new SftpUploadService(sshKeyConfig);

      const settings = service.getConnectionSettings();

      expect(settings.privateKey).toBe(sshKeyConfig.sshKey);
      expect(settings.password).toBeUndefined();
    });

    it('should use default port 22 if not specified', () => {
      const configWithoutPort = { ...defaultConfig, port: undefined };
      service = new SftpUploadService(configWithoutPort);

      const settings = service.getConnectionSettings();

      expect(settings.port).toBe(22);
    });
  });

  describe('testConnection', () => {
    beforeEach(() => {
      service = new SftpUploadService(defaultConfig);
    });

    it('should return success when connection and path exist', async () => {
      mockClient.exists.mockResolvedValue(true);

      const result = await service.testConnection();

      expect(mockClient.connect).toHaveBeenCalled();
      expect(mockClient.exists).toHaveBeenCalledWith('/uploads');
      expect(mockClient.end).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: 'Connection successful',
      });
    });

    it('should return failure when path does not exist', async () => {
      mockClient.exists.mockResolvedValue(false);

      const result = await service.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('does not exist');
    });

    it('should return failure on connection error', async () => {
      mockClient.connect.mockRejectedValue(new Error('Authentication failed'));

      const result = await service.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Authentication failed');
    });

    it('should use default path if pathOnServer is not set', async () => {
      service = new SftpUploadService({ ...defaultConfig, pathOnServer: '' });
      mockClient.exists.mockResolvedValue(true);

      await service.testConnection();

      expect(mockClient.exists).toHaveBeenCalledWith('./');
    });
  });

  describe('upload', () => {
    const sourceUrls = [
      'https://example.com/images/logo.png',
      'https://example.com/images/banner.jpg',
    ];
    const folderName = 'my-mailing';

    beforeEach(() => {
      service = new SftpUploadService(defaultConfig);

      // Mock file download
      const mockWriteStream = {
        on: jest.fn((event, cb) => {
          if (event === 'finish') setTimeout(cb, 0);
          return mockWriteStream;
        }),
      };
      fs.createWriteStream.mockReturnValue(mockWriteStream);

      const mockRequestStream = {
        pipe: jest.fn().mockReturnValue(mockWriteStream),
        on: jest.fn().mockReturnThis(),
      };
      request.get = jest.fn().mockReturnValue(mockRequestStream);
    });

    it('should upload files successfully', async () => {
      mockClient.exists.mockResolvedValue(true);

      const result = await service.upload(sourceUrls, folderName);

      expect(mockClient.connect).toHaveBeenCalled();
      expect(mockClient.fastPut).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
      expect(result.uploadedFiles).toContain('logo.png');
      expect(result.uploadedFiles).toContain('banner.jpg');
      expect(result.errors).toHaveLength(0);
      expect(fs.removeSync).toHaveBeenCalled(); // Cleanup
    });

    it('should create folder if it does not exist', async () => {
      mockClient.exists.mockResolvedValue(false);

      await service.upload(sourceUrls, folderName);

      expect(mockClient.mkdir).toHaveBeenCalledWith('/uploads/my-mailing/', { recursive: true });
    });

    it('should handle upload errors gracefully', async () => {
      mockClient.exists.mockResolvedValue(true);
      mockClient.fastPut
        .mockResolvedValueOnce(undefined) // First file succeeds
        .mockRejectedValueOnce(new Error('Disk full')); // Second file fails

      const result = await service.upload(sourceUrls, folderName);

      expect(result.success).toBe(false);
      expect(result.uploadedFiles).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Disk full');
    });

    it('should handle session errors', async () => {
      mockClient.connect.mockRejectedValue(new Error('Network unreachable'));

      const result = await service.upload(sourceUrls, folderName);

      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('Session error'));
    });

    it('should cleanup temp directory even on error', async () => {
      mockClient.connect.mockRejectedValue(new Error('Connection failed'));

      await service.upload(sourceUrls, folderName);

      expect(fs.removeSync).toHaveBeenCalled();
    });
  });

  describe('normalizePath', () => {
    beforeEach(() => {
      service = new SftpUploadService(defaultConfig);
    });

    it('should return default path for empty input', () => {
      expect(service.normalizePath('')).toBe('./');
      expect(service.normalizePath(null)).toBe('./');
      expect(service.normalizePath(undefined)).toBe('./');
    });

    it('should add trailing slash if missing', () => {
      expect(service.normalizePath('/uploads')).toBe('/uploads/');
    });

    it('should keep existing trailing slash', () => {
      expect(service.normalizePath('/uploads/')).toBe('/uploads/');
    });
  });

  describe('createTempDir', () => {
    beforeEach(() => {
      service = new SftpUploadService(defaultConfig);
    });

    it('should create a unique temp directory', () => {
      const dir1 = service.createTempDir();
      const dir2 = service.createTempDir();

      expect(dir1).toMatch(/^\/tmp\/sftp-upload-[a-f0-9]+$/);
      expect(dir2).toMatch(/^\/tmp\/sftp-upload-[a-f0-9]+$/);
      expect(dir1).not.toBe(dir2);
      expect(fs.mkdirSync).toHaveBeenCalledTimes(2);
    });
  });
});
