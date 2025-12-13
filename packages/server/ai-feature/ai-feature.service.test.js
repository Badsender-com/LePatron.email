'use strict';

const { Types } = require('mongoose');

// Mock dependencies before requiring the service
jest.mock('../common/models.common', () => ({
  AIFeatureConfigs: {
    create: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
  Integrations: {
    findOne: jest.fn(),
  },
}));

jest.mock('../group/group.service', () => ({
  findById: jest.fn(),
}));

const aiFeatureService = require('./ai-feature.service');
const { AIFeatureConfigs, Integrations } = require('../common/models.common');
const groupService = require('../group/group.service');

describe('AIFeatureService', () => {
  const mockGroupId = new Types.ObjectId().toString();
  const mockIntegrationId = new Types.ObjectId().toString();
  const mockConfigId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrCreateConfig', () => {
    it('should return existing config when found', async () => {
      const existingConfig = {
        _id: mockConfigId,
        _company: mockGroupId,
        features: [
          {
            featureType: 'translation',
            integration: null,
            isActive: false,
            config: { availableLanguages: [], defaultSourceLanguage: 'auto' },
          },
        ],
      };

      groupService.findById.mockResolvedValue({ _id: mockGroupId });
      AIFeatureConfigs.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(existingConfig),
      });

      const result = await aiFeatureService.getOrCreateConfig({
        groupId: mockGroupId,
      });

      expect(result).toEqual(existingConfig);
      expect(AIFeatureConfigs.create).not.toHaveBeenCalled();
    });

    it('should create default config when not found', async () => {
      const createdConfig = {
        _id: mockConfigId,
        _company: mockGroupId,
        features: [
          {
            featureType: 'translation',
            integration: null,
            isActive: false,
            config: { availableLanguages: [], defaultSourceLanguage: 'auto' },
          },
        ],
      };

      groupService.findById.mockResolvedValue({ _id: mockGroupId });
      AIFeatureConfigs.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });
      AIFeatureConfigs.create.mockResolvedValue(createdConfig);
      AIFeatureConfigs.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(createdConfig),
      });

      const result = await aiFeatureService.getOrCreateConfig({
        groupId: mockGroupId,
      });

      expect(AIFeatureConfigs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          _company: expect.any(Object),
          features: expect.arrayContaining([
            expect.objectContaining({ featureType: 'translation' }),
          ]),
        })
      );
      expect(result).toEqual(createdConfig);
    });
  });

  describe('updateFeatureConfig', () => {
    it('should update feature with new integration', async () => {
      const existingConfig = {
        _id: mockConfigId,
        _company: mockGroupId,
        features: [
          {
            featureType: 'translation',
            integration: null,
            isActive: false,
            config: { availableLanguages: [], defaultSourceLanguage: 'auto' },
          },
        ],
      };

      const updatedConfig = {
        ...existingConfig,
        features: [
          {
            ...existingConfig.features[0],
            integration: { _id: mockIntegrationId, name: 'OpenAI' },
            isActive: true,
          },
        ],
      };

      groupService.findById.mockResolvedValue({ _id: mockGroupId });
      Integrations.findOne.mockResolvedValue({ _id: mockIntegrationId });
      AIFeatureConfigs.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(existingConfig),
      });
      AIFeatureConfigs.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockResolvedValue(updatedConfig),
      });

      const result = await aiFeatureService.updateFeatureConfig({
        groupId: mockGroupId,
        featureType: 'translation',
        integrationId: mockIntegrationId,
        isActive: true,
      });

      expect(Integrations.findOne).toHaveBeenCalledWith({
        _id: expect.any(Object),
        _company: expect.any(Object),
      });
      expect(AIFeatureConfigs.findByIdAndUpdate).toHaveBeenCalled();
      expect(result).toEqual(updatedConfig);
    });

    it('should update feature languages config', async () => {
      const existingConfig = {
        _id: mockConfigId,
        _company: mockGroupId,
        features: [
          {
            featureType: 'translation',
            integration: null,
            isActive: false,
            config: { availableLanguages: [], defaultSourceLanguage: 'auto' },
          },
        ],
      };

      groupService.findById.mockResolvedValue({ _id: mockGroupId });
      AIFeatureConfigs.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(existingConfig),
      });
      AIFeatureConfigs.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockResolvedValue(existingConfig),
      });

      await aiFeatureService.updateFeatureConfig({
        groupId: mockGroupId,
        featureType: 'translation',
        config: {
          availableLanguages: ['fr', 'en', 'es', 'de'],
          defaultSourceLanguage: 'fr',
        },
      });

      expect(AIFeatureConfigs.findByIdAndUpdate).toHaveBeenCalledWith(
        mockConfigId,
        {
          $set: expect.objectContaining({
            'features.0.config.availableLanguages': ['fr', 'en', 'es', 'de'],
            'features.0.config.defaultSourceLanguage': 'fr',
          }),
        },
        { new: true }
      );
    });

    it('should throw error for invalid feature type', async () => {
      groupService.findById.mockResolvedValue({ _id: mockGroupId });

      await expect(
        aiFeatureService.updateFeatureConfig({
          groupId: mockGroupId,
          featureType: 'invalid_type',
        })
      ).rejects.toThrow('UNAUTHORIZED_INTEGRATION_TYPE');
    });

    it('should throw error when integration not found', async () => {
      groupService.findById.mockResolvedValue({ _id: mockGroupId });
      Integrations.findOne.mockResolvedValue(null);

      await expect(
        aiFeatureService.updateFeatureConfig({
          groupId: mockGroupId,
          featureType: 'translation',
          integrationId: mockIntegrationId,
        })
      ).rejects.toThrow('INTEGRATION_NOT_FOUND');
    });
  });

  describe('getFeatureConfig', () => {
    it('should return specific feature config', async () => {
      const existingConfig = {
        _id: mockConfigId,
        _company: mockGroupId,
        features: [
          {
            featureType: 'translation',
            integration: { _id: mockIntegrationId, name: 'OpenAI' },
            isActive: true,
            config: {
              availableLanguages: ['fr', 'en'],
              defaultSourceLanguage: 'fr',
            },
          },
        ],
      };

      groupService.findById.mockResolvedValue({ _id: mockGroupId });
      AIFeatureConfigs.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(existingConfig),
      });

      const result = await aiFeatureService.getFeatureConfig({
        groupId: mockGroupId,
        featureType: 'translation',
      });

      expect(result.featureType).toBe('translation');
      expect(result.isActive).toBe(true);
    });

    it('should throw error when feature not found', async () => {
      const existingConfig = {
        _id: mockConfigId,
        _company: mockGroupId,
        features: [],
      };

      groupService.findById.mockResolvedValue({ _id: mockGroupId });
      AIFeatureConfigs.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(existingConfig),
      });

      await expect(
        aiFeatureService.getFeatureConfig({
          groupId: mockGroupId,
          featureType: 'translation',
        })
      ).rejects.toThrow('AI_FEATURE_CONFIG_NOT_FOUND');
    });
  });

  describe('getActiveFeatureWithIntegration', () => {
    it('should return feature with integration when active', async () => {
      const mockIntegration = {
        _id: mockIntegrationId,
        name: 'OpenAI',
        provider: 'openai',
        apiKey: 'test-key',
        isActive: true,
      };

      const existingConfig = {
        _id: mockConfigId,
        _company: mockGroupId,
        features: [
          {
            featureType: 'translation',
            integration: mockIntegration,
            isActive: true,
            config: { availableLanguages: ['fr', 'en'] },
          },
        ],
      };

      AIFeatureConfigs.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(existingConfig),
      });

      const result = await aiFeatureService.getActiveFeatureWithIntegration({
        groupId: mockGroupId,
        featureType: 'translation',
      });

      expect(result.feature.featureType).toBe('translation');
      expect(result.integration.name).toBe('OpenAI');
    });

    it('should return null when feature is not active', async () => {
      const existingConfig = {
        _id: mockConfigId,
        _company: mockGroupId,
        features: [
          {
            featureType: 'translation',
            integration: { _id: mockIntegrationId, isActive: true },
            isActive: false,
          },
        ],
      };

      AIFeatureConfigs.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(existingConfig),
      });

      const result = await aiFeatureService.getActiveFeatureWithIntegration({
        groupId: mockGroupId,
        featureType: 'translation',
      });

      expect(result).toBeNull();
    });

    it('should return null when integration is not active', async () => {
      const existingConfig = {
        _id: mockConfigId,
        _company: mockGroupId,
        features: [
          {
            featureType: 'translation',
            integration: { _id: mockIntegrationId, isActive: false },
            isActive: true,
          },
        ],
      };

      AIFeatureConfigs.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(existingConfig),
      });

      const result = await aiFeatureService.getActiveFeatureWithIntegration({
        groupId: mockGroupId,
        featureType: 'translation',
      });

      expect(result).toBeNull();
    });

    it('should return null when no config exists', async () => {
      AIFeatureConfigs.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      const result = await aiFeatureService.getActiveFeatureWithIntegration({
        groupId: mockGroupId,
        featureType: 'translation',
      });

      expect(result).toBeNull();
    });
  });
});
