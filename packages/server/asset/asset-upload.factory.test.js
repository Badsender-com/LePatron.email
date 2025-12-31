'use strict';

// Mock the upload services before requiring the factory
jest.mock('./upload-strategies/sftp-upload.service.js');
jest.mock('./upload-strategies/s3-upload.service.js');

const SftpUploadService = require('./upload-strategies/sftp-upload.service.js');
const S3UploadService = require('./upload-strategies/s3-upload.service.js');
const AssetTypes = require('../constant/asset-type.js');

const {
  createUploadService,
  testAssetConnection,
  uploadToAsset,
  buildPublicUrl,
} = require('./asset-upload.factory.js');

describe('AssetUploadFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createUploadService', () => {
    it('should create SftpUploadService for SFTP type', () => {
      const asset = {
        type: AssetTypes.SFTP,
        sftp: {
          host: 'sftp.example.com',
          port: 22,
          username: 'user',
          password: 'pass',
        },
      };

      const service = createUploadService(asset);

      expect(SftpUploadService).toHaveBeenCalledWith(asset.sftp);
      expect(service).toBeInstanceOf(SftpUploadService);
    });

    it('should create S3UploadService for S3 type', () => {
      const asset = {
        type: AssetTypes.S3,
        s3: {
          endpoint: 's3.amazonaws.com',
          region: 'eu-west-1',
          bucket: 'my-bucket',
          accessKeyId: 'key',
          secretAccessKey: 'secret',
        },
      };

      const service = createUploadService(asset);

      expect(S3UploadService).toHaveBeenCalledWith(asset.s3);
      expect(service).toBeInstanceOf(S3UploadService);
    });

    it('should throw error if asset is null', () => {
      expect(() => createUploadService(null)).toThrow('Asset type is required');
    });

    it('should throw error if asset type is missing', () => {
      expect(() => createUploadService({})).toThrow('Asset type is required');
    });

    it('should throw error for unsupported asset type', () => {
      const asset = { type: 'ftp' };

      expect(() => createUploadService(asset)).toThrow('Unsupported asset type: ftp');
    });
  });

  describe('testAssetConnection', () => {
    it('should call testConnection on SFTP service', async () => {
      const mockTestConnection = jest.fn().mockResolvedValue({
        success: true,
        message: 'Connection successful',
      });
      SftpUploadService.mockImplementation(() => ({
        testConnection: mockTestConnection,
      }));

      const asset = {
        type: AssetTypes.SFTP,
        sftp: { host: 'sftp.example.com' },
      };

      const result = await testAssetConnection(asset);

      expect(mockTestConnection).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should call testConnection on S3 service', async () => {
      const mockTestConnection = jest.fn().mockResolvedValue({
        success: true,
        message: 'Connection successful',
      });
      S3UploadService.mockImplementation(() => ({
        testConnection: mockTestConnection,
      }));

      const asset = {
        type: AssetTypes.S3,
        s3: { bucket: 'my-bucket' },
      };

      const result = await testAssetConnection(asset);

      expect(mockTestConnection).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('uploadToAsset', () => {
    it('should call upload on the appropriate service', async () => {
      const mockUpload = jest.fn().mockResolvedValue({
        success: true,
        uploadedFiles: ['image1.png', 'image2.jpg'],
        errors: [],
      });
      SftpUploadService.mockImplementation(() => ({
        upload: mockUpload,
      }));

      const asset = {
        type: AssetTypes.SFTP,
        sftp: { host: 'sftp.example.com' },
      };
      const sourceUrls = [
        'https://example.com/image1.png',
        'https://example.com/image2.jpg',
      ];
      const folderName = 'my-mailing';

      const result = await uploadToAsset(asset, sourceUrls, folderName);

      expect(mockUpload).toHaveBeenCalledWith(sourceUrls, folderName);
      expect(result.success).toBe(true);
      expect(result.uploadedFiles).toHaveLength(2);
    });

    it('should return errors for failed uploads', async () => {
      const mockUpload = jest.fn().mockResolvedValue({
        success: false,
        uploadedFiles: ['image1.png'],
        errors: ['image2.jpg: Upload failed'],
      });
      S3UploadService.mockImplementation(() => ({
        upload: mockUpload,
      }));

      const asset = {
        type: AssetTypes.S3,
        s3: { bucket: 'my-bucket' },
      };

      const result = await uploadToAsset(asset, ['url1', 'url2'], 'folder');

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('buildPublicUrl', () => {
    it('should build correct URL with trailing slash on endpoint', () => {
      const asset = { publicEndpoint: 'https://cdn.example.com/' };
      const folderName = 'my-mailing';
      const fileName = 'image.png';

      const url = buildPublicUrl(asset, folderName, fileName);

      expect(url).toBe('https://cdn.example.com/my-mailing/image.png');
    });

    it('should add trailing slash if missing', () => {
      const asset = { publicEndpoint: 'https://cdn.example.com' };
      const folderName = 'my-mailing';
      const fileName = 'image.png';

      const url = buildPublicUrl(asset, folderName, fileName);

      expect(url).toBe('https://cdn.example.com/my-mailing/image.png');
    });

    it('should handle folder names with special characters', () => {
      const asset = { publicEndpoint: 'https://cdn.example.com/' };
      const folderName = 'newsletter-2024-01';
      const fileName = 'header-image.jpg';

      const url = buildPublicUrl(asset, folderName, fileName);

      expect(url).toBe('https://cdn.example.com/newsletter-2024-01/header-image.jpg');
    });

    it('should handle S3-style endpoints', () => {
      const asset = { publicEndpoint: 'https://my-bucket.s3.eu-west-1.amazonaws.com' };
      const folderName = 'emails/campaign-123';
      const fileName = 'logo.png';

      const url = buildPublicUrl(asset, folderName, fileName);

      expect(url).toBe(
        'https://my-bucket.s3.eu-west-1.amazonaws.com/emails/campaign-123/logo.png'
      );
    });
  });
});
