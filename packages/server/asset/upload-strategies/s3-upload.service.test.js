'use strict';

// Mock dependencies
jest.mock('aws-sdk');
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

const AWS = require('aws-sdk');
const fs = require('fs-extra');
const request = require('request');
const S3UploadService = require('./s3-upload.service.js');

describe('S3UploadService', () => {
  let service;
  let mockS3;

  const defaultConfig = {
    endpoint: 's3.eu-west-1.amazonaws.com',
    region: 'eu-west-1',
    bucket: 'my-test-bucket',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    pathPrefix: 'emails/',
    forcePathStyle: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockS3 = {
      headBucket: jest.fn().mockReturnValue({
        promise: jest.fn().mockResolvedValue({}),
      }),
      putObject: jest.fn().mockReturnValue({
        promise: jest.fn().mockResolvedValue({}),
      }),
    };

    AWS.S3 = jest.fn().mockImplementation(() => mockS3);
    AWS.Endpoint = jest.fn().mockImplementation((endpoint) => ({ endpoint }));

    fs.mkdirSync = jest.fn();
    fs.removeSync = jest.fn();
    fs.readFileSync = jest.fn().mockReturnValue(Buffer.from('fake-image-data'));
    fs.createWriteStream = jest.fn();
  });

  describe('constructor', () => {
    it('should create service with config and S3 client', () => {
      service = new S3UploadService(defaultConfig);

      expect(service.config).toEqual(defaultConfig);
      expect(AWS.S3).toHaveBeenCalledWith(
        expect.objectContaining({
          accessKeyId: defaultConfig.accessKeyId,
          secretAccessKey: defaultConfig.secretAccessKey,
          region: defaultConfig.region,
        })
      );
    });

    it('should set custom endpoint for S3-compatible services', () => {
      service = new S3UploadService(defaultConfig);

      expect(AWS.Endpoint).toHaveBeenCalledWith(defaultConfig.endpoint);
    });

    it('should use default region if not specified', () => {
      const configWithoutRegion = { ...defaultConfig, region: undefined };
      service = new S3UploadService(configWithoutRegion);

      expect(AWS.S3).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'us-east-1',
        })
      );
    });

    it('should respect forcePathStyle option', () => {
      const configWithPathStyle = { ...defaultConfig, forcePathStyle: true };
      service = new S3UploadService(configWithPathStyle);

      expect(AWS.S3).toHaveBeenCalledWith(
        expect.objectContaining({
          s3ForcePathStyle: true,
        })
      );
    });
  });

  describe('testConnection', () => {
    beforeEach(() => {
      service = new S3UploadService(defaultConfig);
    });

    it('should return success when bucket is accessible', async () => {
      const result = await service.testConnection();

      expect(mockS3.headBucket).toHaveBeenCalledWith({
        Bucket: defaultConfig.bucket,
      });
      expect(result).toEqual({
        success: true,
        message: 'Connection successful',
      });
    });

    it('should return failure for NotFound error', async () => {
      const error = new Error('Bucket not found');
      error.code = 'NotFound';
      mockS3.headBucket.mockReturnValue({
        promise: jest.fn().mockRejectedValue(error),
      });

      const result = await service.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should return failure for Forbidden error', async () => {
      const error = new Error('Access denied');
      error.code = 'Forbidden';
      mockS3.headBucket.mockReturnValue({
        promise: jest.fn().mockRejectedValue(error),
      });

      const result = await service.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Access denied');
    });

    it('should return failure for InvalidAccessKeyId error', async () => {
      const error = new Error('Invalid key');
      error.code = 'InvalidAccessKeyId';
      mockS3.headBucket.mockReturnValue({
        promise: jest.fn().mockRejectedValue(error),
      });

      const result = await service.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid Access Key ID');
    });

    it('should return failure for SignatureDoesNotMatch error', async () => {
      const error = new Error('Signature mismatch');
      error.code = 'SignatureDoesNotMatch';
      mockS3.headBucket.mockReturnValue({
        promise: jest.fn().mockRejectedValue(error),
      });

      const result = await service.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid Secret Access Key');
    });
  });

  describe('upload', () => {
    const sourceUrls = [
      'https://example.com/images/logo.png',
      'https://example.com/images/banner.jpg',
    ];
    const folderName = 'my-mailing';

    beforeEach(() => {
      service = new S3UploadService(defaultConfig);

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

    it('should upload files successfully in parallel', async () => {
      const result = await service.upload(sourceUrls, folderName);

      expect(mockS3.putObject).toHaveBeenCalledTimes(2);
      expect(mockS3.putObject).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: defaultConfig.bucket,
          Key: 'emails/my-mailing/logo.png',
          ContentType: 'image/png',
        })
      );
      expect(mockS3.putObject).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: defaultConfig.bucket,
          Key: 'emails/my-mailing/banner.jpg',
          ContentType: 'image/jpeg',
        })
      );
      expect(result.success).toBe(true);
      expect(result.uploadedFiles).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle upload errors gracefully', async () => {
      mockS3.putObject
        .mockReturnValueOnce({
          promise: jest.fn().mockResolvedValue({}),
        })
        .mockReturnValueOnce({
          promise: jest.fn().mockRejectedValue(new Error('Upload failed')),
        });

      const result = await service.upload(sourceUrls, folderName);

      expect(result.success).toBe(false);
      expect(result.uploadedFiles).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Upload failed');
    });

    it('should cleanup temp directory after upload', async () => {
      await service.upload(sourceUrls, folderName);

      expect(fs.removeSync).toHaveBeenCalled();
    });

    it('should handle empty path prefix', async () => {
      service = new S3UploadService({ ...defaultConfig, pathPrefix: '' });

      await service.upload(['https://example.com/image.png'], 'folder');

      expect(mockS3.putObject).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: 'folder/image.png',
        })
      );
    });
  });

  describe('normalizePath', () => {
    beforeEach(() => {
      service = new S3UploadService(defaultConfig);
    });

    it('should return empty string for empty input', () => {
      expect(service.normalizePath('')).toBe('');
      expect(service.normalizePath(null)).toBe('');
      expect(service.normalizePath(undefined)).toBe('');
    });

    it('should remove leading slash', () => {
      expect(service.normalizePath('/emails/')).toBe('emails/');
      expect(service.normalizePath('//emails/')).toBe('emails/');
    });

    it('should add trailing slash if missing', () => {
      expect(service.normalizePath('emails')).toBe('emails/');
    });

    it('should handle path with both issues', () => {
      expect(service.normalizePath('/emails')).toBe('emails/');
    });
  });

  describe('getContentType', () => {
    beforeEach(() => {
      service = new S3UploadService(defaultConfig);
    });

    it('should return correct content type for jpg', () => {
      expect(service.getContentType('image.jpg')).toBe('image/jpeg');
      expect(service.getContentType('image.jpeg')).toBe('image/jpeg');
    });

    it('should return correct content type for png', () => {
      expect(service.getContentType('image.png')).toBe('image/png');
    });

    it('should return correct content type for gif', () => {
      expect(service.getContentType('image.gif')).toBe('image/gif');
    });

    it('should return correct content type for webp', () => {
      expect(service.getContentType('image.webp')).toBe('image/webp');
    });

    it('should return correct content type for svg', () => {
      expect(service.getContentType('image.svg')).toBe('image/svg+xml');
    });

    it('should return octet-stream for unknown extensions', () => {
      expect(service.getContentType('file.xyz')).toBe('application/octet-stream');
      expect(service.getContentType('file')).toBe('application/octet-stream');
    });

    it('should handle uppercase extensions', () => {
      expect(service.getContentType('image.PNG')).toBe('image/png');
      expect(service.getContentType('image.JPG')).toBe('image/jpeg');
    });
  });

  describe('createTempDir', () => {
    beforeEach(() => {
      service = new S3UploadService(defaultConfig);
    });

    it('should create a unique temp directory', () => {
      const dir1 = service.createTempDir();
      const dir2 = service.createTempDir();

      expect(dir1).toMatch(/^\/tmp\/s3-upload-[a-f0-9]+$/);
      expect(dir2).toMatch(/^\/tmp\/s3-upload-[a-f0-9]+$/);
      expect(dir1).not.toBe(dir2);
      expect(fs.mkdirSync).toHaveBeenCalledTimes(2);
    });
  });
});
