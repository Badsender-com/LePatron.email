'use strict';

const { Types } = require('mongoose');

// Mock dependencies before requiring the service
jest.mock('../common/models.common.js', () => ({
  ExportProfiles: {
    create: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    exists: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
  },
  Assets: {
    findOne: jest.fn(),
  },
  Profiles: {
    findOne: jest.fn(),
  },
}));

jest.mock('../group/group.service.js', () => ({
  findById: jest.fn(),
}));

const { ExportProfiles, Assets, Profiles } = require('../common/models.common.js');
const groupService = require('../group/group.service.js');
const exportProfileService = require('./export-profile.service.js');
const ERROR_CODES = require('../constant/error-codes.js');
const DeliveryMethods = require('../constant/delivery-method.js');
const AssetMethods = require('../constant/asset-method.js');

describe('ExportProfileService', () => {
  const mockGroupId = new Types.ObjectId().toString();
  const mockExportProfileId = new Types.ObjectId().toString();
  const mockEspProfileId = new Types.ObjectId().toString();
  const mockAssetId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    groupService.findById.mockResolvedValue({ _id: mockGroupId });
  });

  describe('createExportProfile', () => {
    const validEspProfileData = {
      groupId: mockGroupId,
      name: 'Adobe Prod',
      deliveryMethod: DeliveryMethods.ESP,
      espProfileId: mockEspProfileId,
      assetMethod: AssetMethods.ESP_API,
      isActive: true,
    };

    const validDownloadProfileData = {
      groupId: mockGroupId,
      name: 'ZIP Local',
      deliveryMethod: DeliveryMethods.DOWNLOAD,
      assetMethod: AssetMethods.ZIP,
      isActive: true,
    };

    const validAssetProfileData = {
      groupId: mockGroupId,
      name: 'Actito + CDN',
      deliveryMethod: DeliveryMethods.ESP,
      espProfileId: mockEspProfileId,
      assetMethod: AssetMethods.ASSET,
      assetId: mockAssetId,
      isActive: true,
    };

    beforeEach(() => {
      ExportProfiles.findOne.mockResolvedValue(null);
      Profiles.findOne.mockResolvedValue({ _id: mockEspProfileId, name: 'Adobe' });
      Assets.findOne.mockResolvedValue({ _id: mockAssetId, name: 'CDN S3' });
    });

    it('should create an ESP profile with esp_api asset method', async () => {
      ExportProfiles.create.mockResolvedValue({
        _id: mockExportProfileId,
        ...validEspProfileData,
      });

      const result = await exportProfileService.createExportProfile(validEspProfileData);

      expect(groupService.findById).toHaveBeenCalledWith(mockGroupId);
      expect(Profiles.findOne).toHaveBeenCalled();
      expect(ExportProfiles.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: validEspProfileData.name,
          _company: mockGroupId,
          deliveryMethod: DeliveryMethods.ESP,
          assetMethod: AssetMethods.ESP_API,
          _espProfile: mockEspProfileId,
        })
      );
      expect(result._id).toBe(mockExportProfileId);
    });

    it('should create a download profile with zip asset method', async () => {
      ExportProfiles.create.mockResolvedValue({
        _id: mockExportProfileId,
        ...validDownloadProfileData,
      });

      const result = await exportProfileService.createExportProfile(validDownloadProfileData);

      expect(ExportProfiles.create).toHaveBeenCalledWith(
        expect.objectContaining({
          deliveryMethod: DeliveryMethods.DOWNLOAD,
          assetMethod: AssetMethods.ZIP,
        })
      );
      expect(result._id).toBe(mockExportProfileId);
    });

    it('should create an ESP profile with external asset', async () => {
      ExportProfiles.create.mockResolvedValue({
        _id: mockExportProfileId,
        ...validAssetProfileData,
      });

      const result = await exportProfileService.createExportProfile(validAssetProfileData);

      expect(Assets.findOne).toHaveBeenCalled();
      expect(ExportProfiles.create).toHaveBeenCalledWith(
        expect.objectContaining({
          assetMethod: AssetMethods.ASSET,
          _asset: mockAssetId,
        })
      );
      expect(result._id).toBe(mockExportProfileId);
    });

    it('should throw Conflict error if name already exists', async () => {
      ExportProfiles.findOne.mockResolvedValue({ _id: 'existing-id' });

      await expect(
        exportProfileService.createExportProfile(validEspProfileData)
      ).rejects.toThrow(ERROR_CODES.EXPORT_PROFILE_NAME_ALREADY_EXISTS);
    });

    it('should throw BadRequest if ESP delivery without espProfileId', async () => {
      const invalidData = {
        ...validEspProfileData,
        espProfileId: undefined,
      };

      await expect(
        exportProfileService.createExportProfile(invalidData)
      ).rejects.toThrow(ERROR_CODES.EXPORT_PROFILE_INVALID_CONFIG);
    });

    it('should throw BadRequest if asset method is asset without assetId', async () => {
      const invalidData = {
        ...validAssetProfileData,
        assetId: undefined,
      };

      await expect(
        exportProfileService.createExportProfile(invalidData)
      ).rejects.toThrow(ERROR_CODES.EXPORT_PROFILE_INVALID_CONFIG);
    });

    it('should throw BadRequest if esp_api with download delivery method', async () => {
      const invalidData = {
        groupId: mockGroupId,
        name: 'Invalid',
        deliveryMethod: DeliveryMethods.DOWNLOAD,
        assetMethod: AssetMethods.ESP_API,
      };

      await expect(
        exportProfileService.createExportProfile(invalidData)
      ).rejects.toThrow(ERROR_CODES.EXPORT_PROFILE_INVALID_CONFIG);
    });

    it('should throw NotFound if ESP profile does not exist', async () => {
      Profiles.findOne.mockResolvedValue(null);

      await expect(
        exportProfileService.createExportProfile(validEspProfileData)
      ).rejects.toThrow(ERROR_CODES.PROFILE_NOT_FOUND);
    });

    it('should throw NotFound if asset does not exist', async () => {
      Assets.findOne.mockResolvedValue(null);

      await expect(
        exportProfileService.createExportProfile(validAssetProfileData)
      ).rejects.toThrow(ERROR_CODES.ASSET_NOT_FOUND);
    });
  });

  describe('updateExportProfile', () => {
    const existingProfile = {
      _id: mockExportProfileId,
      _company: mockGroupId,
      name: 'Original Name',
      deliveryMethod: DeliveryMethods.ESP,
      _espProfile: mockEspProfileId,
      assetMethod: AssetMethods.ESP_API,
      _asset: null,
      isActive: true,
    };

    beforeEach(() => {
      ExportProfiles.exists.mockResolvedValue(true);
      ExportProfiles.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(existingProfile),
        }),
      });
      ExportProfiles.updateOne.mockResolvedValue({ modifiedCount: 1 });
      Profiles.findOne.mockResolvedValue({ _id: mockEspProfileId });
      Assets.findOne.mockResolvedValue({ _id: mockAssetId });
    });

    it('should update profile name', async () => {
      const updatedProfile = { ...existingProfile, name: 'New Name' };
      ExportProfiles.findOne
        .mockReturnValueOnce({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(existingProfile),
          }),
        })
        .mockReturnValueOnce(null) // duplicate check
        .mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(updatedProfile),
          }),
        });

      const result = await exportProfileService.updateExportProfile({
        exportProfileId: mockExportProfileId,
        name: 'New Name',
      });

      expect(ExportProfiles.updateOne).toHaveBeenCalled();
      expect(result.name).toBe('New Name');
    });

    it('should throw Conflict if new name already exists', async () => {
      ExportProfiles.findOne
        .mockReturnValueOnce({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(existingProfile),
          }),
        })
        .mockResolvedValueOnce({ _id: 'other-id', name: 'Taken Name' });

      await expect(
        exportProfileService.updateExportProfile({
          exportProfileId: mockExportProfileId,
          name: 'Taken Name',
        })
      ).rejects.toThrow(ERROR_CODES.EXPORT_PROFILE_NAME_ALREADY_EXISTS);
    });

    it('should update isActive status', async () => {
      const updatedProfile = { ...existingProfile, isActive: false };
      ExportProfiles.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(updatedProfile),
        }),
      });

      await exportProfileService.updateExportProfile({
        exportProfileId: mockExportProfileId,
        isActive: false,
      });

      expect(ExportProfiles.updateOne).toHaveBeenCalledWith(
        expect.any(Object),
        { $set: expect.objectContaining({ isActive: false }) }
      );
    });
  });

  describe('findAllByGroup', () => {
    it('should return all export profiles for a group', async () => {
      const mockProfiles = [
        { name: 'Profile A' },
        { name: 'Profile B' },
      ];
      ExportProfiles.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue(mockProfiles),
          }),
        }),
      });

      const result = await exportProfileService.findAllByGroup({ groupId: mockGroupId });

      expect(groupService.findById).toHaveBeenCalledWith(mockGroupId);
      expect(ExportProfiles.find).toHaveBeenCalledWith({ _company: mockGroupId });
      expect(result).toEqual(mockProfiles);
    });
  });

  describe('findActiveByGroup', () => {
    it('should return only active export profiles', async () => {
      const mockProfiles = [{ name: 'Active Profile', isActive: true }];
      ExportProfiles.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue(mockProfiles),
          }),
        }),
      });

      const result = await exportProfileService.findActiveByGroup({ groupId: mockGroupId });

      expect(ExportProfiles.find).toHaveBeenCalledWith({
        _company: mockGroupId,
        isActive: true,
      });
      expect(result).toEqual(mockProfiles);
    });
  });

  describe('findOne', () => {
    it('should return export profile by ID', async () => {
      const mockProfile = { _id: mockExportProfileId, name: 'Test Profile' };
      ExportProfiles.exists.mockResolvedValue(true);
      ExportProfiles.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockProfile),
        }),
      });

      const result = await exportProfileService.findOne(mockExportProfileId);

      expect(result).toEqual(mockProfile);
    });

    it('should throw NotFound if export profile does not exist', async () => {
      ExportProfiles.exists.mockResolvedValue(false);

      await expect(
        exportProfileService.findOne(mockExportProfileId)
      ).rejects.toThrow(ERROR_CODES.EXPORT_PROFILE_NOT_FOUND);
    });
  });

  describe('deleteExportProfile', () => {
    beforeEach(() => {
      ExportProfiles.exists.mockResolvedValue(true);
    });

    it('should delete export profile successfully', async () => {
      ExportProfiles.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const result = await exportProfileService.deleteExportProfile({
        exportProfileId: mockExportProfileId,
      });

      expect(ExportProfiles.deleteOne).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.deletedId).toBe(mockExportProfileId);
    });

    it('should throw error if delete fails', async () => {
      ExportProfiles.deleteOne.mockResolvedValue({ deletedCount: 0 });

      await expect(
        exportProfileService.deleteExportProfile({
          exportProfileId: mockExportProfileId,
        })
      ).rejects.toThrow(ERROR_CODES.FAILED_EXPORT_PROFILE_DELETE);
    });
  });

  describe('validateExportProfileConfig', () => {
    beforeEach(() => {
      Profiles.findOne.mockResolvedValue({ _id: mockEspProfileId });
      Assets.findOne.mockResolvedValue({ _id: mockAssetId });
    });

    it('should validate ESP + esp_api config', async () => {
      const result = await exportProfileService.validateExportProfileConfig({
        groupId: mockGroupId,
        deliveryMethod: DeliveryMethods.ESP,
        espProfileId: mockEspProfileId,
        assetMethod: AssetMethods.ESP_API,
      });

      expect(result).toBe(true);
    });

    it('should validate DOWNLOAD + zip config', async () => {
      const result = await exportProfileService.validateExportProfileConfig({
        groupId: mockGroupId,
        deliveryMethod: DeliveryMethods.DOWNLOAD,
        assetMethod: AssetMethods.ZIP,
      });

      expect(result).toBe(true);
    });

    it('should validate ESP + asset config', async () => {
      const result = await exportProfileService.validateExportProfileConfig({
        groupId: mockGroupId,
        deliveryMethod: DeliveryMethods.ESP,
        espProfileId: mockEspProfileId,
        assetMethod: AssetMethods.ASSET,
        assetId: mockAssetId,
      });

      expect(result).toBe(true);
    });

    it('should throw for invalid delivery method', async () => {
      await expect(
        exportProfileService.validateExportProfileConfig({
          groupId: mockGroupId,
          deliveryMethod: 'invalid',
          assetMethod: AssetMethods.ZIP,
        })
      ).rejects.toThrow(ERROR_CODES.EXPORT_PROFILE_INVALID_CONFIG);
    });

    it('should throw for invalid asset method', async () => {
      await expect(
        exportProfileService.validateExportProfileConfig({
          groupId: mockGroupId,
          deliveryMethod: DeliveryMethods.DOWNLOAD,
          assetMethod: 'invalid',
        })
      ).rejects.toThrow(ERROR_CODES.EXPORT_PROFILE_INVALID_CONFIG);
    });
  });
});
