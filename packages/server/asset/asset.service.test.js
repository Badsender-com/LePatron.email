'use strict';

const { Types } = require('mongoose');

// Mock dependencies before requiring the service
jest.mock('../common/models.common.js', () => ({
  Assets: {
    create: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    exists: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
    countDocuments: jest.fn(),
  },
  ExportProfiles: {
    find: jest.fn(),
  },
}));

jest.mock('../group/group.service.js', () => ({
  findById: jest.fn(),
}));

jest.mock('./asset-upload.factory.js', () => ({
  testAssetConnection: jest.fn(),
}));

const { Assets, ExportProfiles } = require('../common/models.common.js');
const groupService = require('../group/group.service.js');
const { testAssetConnection } = require('./asset-upload.factory.js');
const assetService = require('./asset.service.js');
const ERROR_CODES = require('../constant/error-codes.js');
const AssetTypes = require('../constant/asset-type.js');

describe('AssetService', () => {
  const mockGroupId = new Types.ObjectId().toString();
  const mockAssetId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    groupService.findById.mockResolvedValue({ _id: mockGroupId });
  });

  describe('createAsset', () => {
    const validSftpData = {
      groupId: mockGroupId,
      name: 'Test SFTP Asset',
      type: AssetTypes.SFTP,
      sftp: {
        host: 'sftp.example.com',
        port: 22,
        username: 'user',
        password: 'secret',
        pathOnServer: '/uploads',
      },
      publicEndpoint: 'https://cdn.example.com',
      isActive: true,
    };

    const validS3Data = {
      groupId: mockGroupId,
      name: 'Test S3 Asset',
      type: AssetTypes.S3,
      s3: {
        endpoint: 's3.amazonaws.com',
        region: 'eu-west-1',
        bucket: 'my-bucket',
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'secret',
        pathPrefix: 'emails/',
      },
      publicEndpoint: 'https://my-bucket.s3.amazonaws.com',
      isActive: true,
    };

    it('should create a SFTP asset successfully', async () => {
      Assets.findOne.mockResolvedValue(null); // No duplicate
      Assets.create.mockResolvedValue({ _id: mockAssetId, ...validSftpData });

      const result = await assetService.createAsset(validSftpData);

      expect(groupService.findById).toHaveBeenCalledWith(mockGroupId);
      expect(Assets.findOne).toHaveBeenCalledWith({
        _company: mockGroupId,
        name: validSftpData.name,
      });
      expect(Assets.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: validSftpData.name,
          _company: mockGroupId,
          type: AssetTypes.SFTP,
          sftp: validSftpData.sftp,
          publicEndpoint: validSftpData.publicEndpoint,
          isActive: true,
        })
      );
      expect(result._id).toBe(mockAssetId);
    });

    it('should create a S3 asset successfully', async () => {
      Assets.findOne.mockResolvedValue(null);
      Assets.create.mockResolvedValue({ _id: mockAssetId, ...validS3Data });

      const result = await assetService.createAsset(validS3Data);

      expect(Assets.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: validS3Data.name,
          type: AssetTypes.S3,
          s3: validS3Data.s3,
        })
      );
      expect(result._id).toBe(mockAssetId);
    });

    it('should throw Conflict error if asset name already exists', async () => {
      Assets.findOne.mockResolvedValue({ _id: 'existing-id', name: validSftpData.name });

      await expect(assetService.createAsset(validSftpData)).rejects.toThrow(
        ERROR_CODES.ASSET_NAME_ALREADY_EXISTS
      );
    });

    it('should throw BadRequest error for invalid asset type', async () => {
      const invalidData = { ...validSftpData, type: 'invalid' };

      await expect(assetService.createAsset(invalidData)).rejects.toThrow(
        ERROR_CODES.ASSET_INVALID_TYPE
      );
    });

    it('should throw BadRequest error for missing asset type', async () => {
      const invalidData = { ...validSftpData, type: undefined };

      await expect(assetService.createAsset(invalidData)).rejects.toThrow(
        ERROR_CODES.ASSET_INVALID_TYPE
      );
    });
  });

  describe('updateAsset', () => {
    const existingAsset = {
      _id: mockAssetId,
      _company: mockGroupId,
      name: 'Original Name',
      type: AssetTypes.SFTP,
      sftp: {
        host: 'old-host.com',
        port: 22,
        username: 'olduser',
        password: 'oldpassword',
        sshKey: '',
        pathOnServer: '/old',
        toObject: function () {
          return {
            host: this.host,
            port: this.port,
            username: this.username,
            password: this.password,
            sshKey: this.sshKey,
            pathOnServer: this.pathOnServer,
          };
        },
      },
      publicEndpoint: 'https://old.example.com',
      isActive: true,
    };

    beforeEach(() => {
      Assets.exists.mockResolvedValue(true);
      Assets.findOne.mockResolvedValue(existingAsset);
      Assets.updateOne.mockResolvedValue({ modifiedCount: 1, matchedCount: 1 });
    });

    it('should update asset name successfully', async () => {
      const updatedAsset = { ...existingAsset, name: 'New Name' };
      Assets.findOne
        .mockResolvedValueOnce(existingAsset) // findOne for existing
        .mockResolvedValueOnce(null) // findOne for duplicate check
        .mockResolvedValueOnce(updatedAsset); // findOne after update

      const result = await assetService.updateAsset({
        assetId: mockAssetId,
        name: 'New Name',
      });

      expect(Assets.updateOne).toHaveBeenCalled();
      expect(result.name).toBe('New Name');
    });

    it('should preserve existing password if not provided', async () => {
      Assets.findOne
        .mockResolvedValueOnce(existingAsset)
        .mockResolvedValueOnce(existingAsset);

      await assetService.updateAsset({
        assetId: mockAssetId,
        sftp: { host: 'new-host.com', password: '' },
      });

      expect(Assets.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(Object) },
        {
          $set: expect.objectContaining({
            sftp: expect.objectContaining({
              host: 'new-host.com',
              password: 'oldpassword', // preserved
            }),
          }),
        }
      );
    });

    it('should throw Conflict error if new name already exists', async () => {
      Assets.findOne
        .mockResolvedValueOnce(existingAsset)
        .mockResolvedValueOnce({ _id: 'other-id', name: 'Taken Name' });

      await expect(
        assetService.updateAsset({
          assetId: mockAssetId,
          name: 'Taken Name',
        })
      ).rejects.toThrow(ERROR_CODES.ASSET_NAME_ALREADY_EXISTS);
    });
  });

  describe('findAllByGroup', () => {
    it('should return all assets for a group sorted by name', async () => {
      const mockAssets = [
        { name: 'Asset A' },
        { name: 'Asset B' },
      ];
      Assets.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockAssets),
      });

      const result = await assetService.findAllByGroup({ groupId: mockGroupId });

      expect(groupService.findById).toHaveBeenCalledWith(mockGroupId);
      expect(Assets.find).toHaveBeenCalledWith({ _company: mockGroupId });
      expect(result).toEqual(mockAssets);
    });
  });

  describe('findActiveByGroup', () => {
    it('should return only active assets', async () => {
      const mockAssets = [{ name: 'Active Asset', isActive: true }];
      Assets.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockAssets),
      });

      const result = await assetService.findActiveByGroup({ groupId: mockGroupId });

      expect(Assets.find).toHaveBeenCalledWith({
        _company: mockGroupId,
        isActive: true,
      });
      expect(result).toEqual(mockAssets);
    });
  });

  describe('findOne', () => {
    it('should return asset by ID', async () => {
      const mockAsset = { _id: mockAssetId, name: 'Test Asset' };
      Assets.exists.mockResolvedValue(true);
      Assets.findOne.mockResolvedValue(mockAsset);

      const result = await assetService.findOne(mockAssetId);

      expect(result).toEqual(mockAsset);
    });

    it('should throw NotFound error if asset does not exist', async () => {
      Assets.exists.mockResolvedValue(false);

      await expect(assetService.findOne(mockAssetId)).rejects.toThrow(
        ERROR_CODES.ASSET_NOT_FOUND
      );
    });
  });

  describe('deleteAsset', () => {
    beforeEach(() => {
      Assets.exists.mockResolvedValue(true);
      Assets.findOne.mockResolvedValue({ _id: mockAssetId, name: 'Test' });
      ExportProfiles.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([]),
      });
    });

    it('should delete asset successfully when not in use', async () => {
      Assets.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const result = await assetService.deleteAsset({ assetId: mockAssetId });

      expect(ExportProfiles.find).toHaveBeenCalledWith({ _asset: expect.any(Object) });
      expect(Assets.deleteOne).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.deletedId).toBe(mockAssetId);
    });

    it('should throw Conflict error if asset is used by ExportProfiles', async () => {
      const mockExportProfiles = [
        { _id: 'profile1', name: 'Profile 1' },
        { _id: 'profile2', name: 'Profile 2' },
      ];
      ExportProfiles.find.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockExportProfiles),
      });

      await expect(
        assetService.deleteAsset({ assetId: mockAssetId })
      ).rejects.toThrow(ERROR_CODES.ASSET_IN_USE);
    });

    it('should force delete asset even if in use', async () => {
      const mockExportProfiles = [{ _id: 'profile1', name: 'Profile 1' }];
      ExportProfiles.find.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockExportProfiles),
      });
      Assets.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const result = await assetService.deleteAsset({ assetId: mockAssetId, force: true });

      expect(ExportProfiles.find).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should throw error if delete fails', async () => {
      Assets.deleteOne.mockResolvedValue({ deletedCount: 0 });

      await expect(
        assetService.deleteAsset({ assetId: mockAssetId })
      ).rejects.toThrow(ERROR_CODES.FAILED_ASSET_DELETE);
    });
  });

  describe('findExportProfilesUsingAsset', () => {
    it('should return export profiles using the asset', async () => {
      const mockProfiles = [{ _id: 'p1', name: 'Profile 1' }];
      ExportProfiles.find.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockProfiles),
      });

      const result = await assetService.findExportProfilesUsingAsset(mockAssetId);

      expect(ExportProfiles.find).toHaveBeenCalledWith({ _asset: expect.any(Object) });
      expect(result).toEqual(mockProfiles);
    });

    it('should return empty array if no profiles use the asset', async () => {
      ExportProfiles.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([]),
      });

      const result = await assetService.findExportProfilesUsingAsset(mockAssetId);

      expect(result).toEqual([]);
    });
  });

  describe('testConnection', () => {
    it('should test existing asset connection', async () => {
      const mockAsset = { _id: mockAssetId, type: AssetTypes.SFTP };
      Assets.exists.mockResolvedValue(true);
      Assets.findOne.mockResolvedValue(mockAsset);
      testAssetConnection.mockResolvedValue({ success: true, message: 'OK' });

      const result = await assetService.testConnection({ assetId: mockAssetId });

      expect(testAssetConnection).toHaveBeenCalledWith(mockAsset);
      expect(result.success).toBe(true);
    });

    it('should test with provided asset data', async () => {
      const assetData = { type: AssetTypes.S3, s3: { bucket: 'test' } };
      testAssetConnection.mockResolvedValue({ success: true, message: 'OK' });

      const result = await assetService.testConnection({ assetData });

      expect(testAssetConnection).toHaveBeenCalledWith(assetData);
      expect(result.success).toBe(true);
    });

    it('should return failure result on connection error', async () => {
      const mockAsset = { _id: mockAssetId, type: AssetTypes.SFTP };
      Assets.exists.mockResolvedValue(true);
      Assets.findOne.mockResolvedValue(mockAsset);
      testAssetConnection.mockRejectedValue(new Error('Connection refused'));

      const result = await assetService.testConnection({ assetId: mockAssetId });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Connection refused');
    });

    it('should throw error if neither assetId nor assetData provided', async () => {
      await expect(assetService.testConnection({})).rejects.toThrow(
        'Either assetId or assetData is required'
      );
    });
  });
});
