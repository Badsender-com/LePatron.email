'use strict';

const { Types } = require('mongoose');

// Mock dependencies before requiring the service
jest.mock('../common/models.common', () => ({
  Integrations: {
    create: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    deleteOne: jest.fn(),
    exists: jest.fn(),
  },
}));

jest.mock('../group/group.service', () => ({
  findById: jest.fn(),
}));

jest.mock('../integration-providers/provider-factory', () => ({
  createProvider: jest.fn(),
}));

const integrationService = require('./integration.service');
const { Integrations } = require('../common/models.common');
const groupService = require('../group/group.service');
const ProviderFactory = require('../integration-providers/provider-factory');

describe('IntegrationService', () => {
  const mockGroupId = new Types.ObjectId().toString();
  const mockIntegrationId = new Types.ObjectId().toString();
  const _mockUserId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createIntegration', () => {
    it('should create a new integration', async () => {
      const integrationData = {
        name: 'My OpenAI',
        type: 'ai',
        provider: 'openai',
        apiKey: 'sk-test-key',
        apiHost: null,
        config: {},
        _company: mockGroupId,
      };

      const createdIntegration = {
        _id: mockIntegrationId,
        ...integrationData,
        isActive: true,
        validationStatus: 'pending',
      };

      Integrations.exists.mockResolvedValue(false);
      Integrations.create.mockResolvedValue(createdIntegration);

      const result = await integrationService.createIntegration(
        integrationData
      );

      expect(Integrations.exists).toHaveBeenCalledWith({
        name: 'My OpenAI',
        _company: mockGroupId,
        type: 'ai',
      });
      expect(Integrations.create).toHaveBeenCalledWith({
        name: 'My OpenAI',
        type: 'ai',
        provider: 'openai',
        apiKey: 'sk-test-key',
        apiHost: null,
        config: {},
        _company: mockGroupId,
        isActive: true,
        validationStatus: 'pending',
      });
      expect(result).toEqual(createdIntegration);
    });

    it('should throw conflict error if integration name already exists', async () => {
      Integrations.exists.mockResolvedValue(true);

      await expect(
        integrationService.createIntegration({
          name: 'Duplicate Name',
          type: 'ai',
          provider: 'openai',
          apiKey: 'key',
          _company: mockGroupId,
        })
      ).rejects.toThrow('INTEGRATION_NAME_ALREADY_EXIST');
    });
  });

  describe('findOne', () => {
    it('should return integration when found', async () => {
      const mockIntegration = {
        _id: mockIntegrationId,
        name: 'Test Integration',
      };

      Integrations.findOne.mockResolvedValue(mockIntegration);

      const result = await integrationService.findOne(mockIntegrationId);

      expect(result).toEqual(mockIntegration);
    });

    it('should throw NotFound when integration does not exist', async () => {
      Integrations.findOne.mockResolvedValue(null);

      await expect(
        integrationService.findOne(mockIntegrationId)
      ).rejects.toThrow('INTEGRATION_NOT_FOUND');
    });
  });

  describe('findAllByGroup', () => {
    it('should return all integrations for a group', async () => {
      const mockIntegrations = [
        { _id: '1', name: 'Integration 1' },
        { _id: '2', name: 'Integration 2' },
      ];

      groupService.findById.mockResolvedValue({ _id: mockGroupId });
      Integrations.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockIntegrations),
      });

      const result = await integrationService.findAllByGroup({
        groupId: mockGroupId,
      });

      expect(groupService.findById).toHaveBeenCalledWith(mockGroupId);
      expect(result).toEqual(mockIntegrations);
    });
  });

  describe('findByGroupAndType', () => {
    it('should return integrations filtered by type', async () => {
      const mockIntegrations = [
        { _id: '1', name: 'AI Integration', type: 'ai' },
      ];

      groupService.findById.mockResolvedValue({ _id: mockGroupId });
      Integrations.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockIntegrations),
      });

      const result = await integrationService.findByGroupAndType({
        groupId: mockGroupId,
        type: 'ai',
      });

      expect(result).toEqual(mockIntegrations);
    });
  });

  describe('updateIntegration', () => {
    it('should update integration fields', async () => {
      const existingIntegration = {
        _id: mockIntegrationId,
        name: 'Old Name',
        type: 'ai',
        _company: mockGroupId,
      };

      const updatedIntegration = {
        ...existingIntegration,
        name: 'New Name',
      };

      Integrations.findOne.mockResolvedValue(existingIntegration);
      Integrations.exists.mockResolvedValue(false);
      Integrations.findByIdAndUpdate.mockResolvedValue(updatedIntegration);

      const result = await integrationService.updateIntegration({
        integrationId: mockIntegrationId,
        name: 'New Name',
      });

      expect(result.name).toBe('New Name');
    });

    it('should reset validation status when API key changes', async () => {
      const existingIntegration = {
        _id: mockIntegrationId,
        name: 'Test',
        type: 'ai',
        _company: mockGroupId,
        apiKey: 'old-key',
      };

      Integrations.findOne.mockResolvedValue(existingIntegration);
      Integrations.findByIdAndUpdate.mockResolvedValue({});

      await integrationService.updateIntegration({
        integrationId: mockIntegrationId,
        apiKey: 'new-key',
      });

      expect(Integrations.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          apiKey: 'new-key',
          validationStatus: 'pending',
          lastValidatedAt: null,
        }),
        { new: true }
      );
    });
  });

  describe('deleteIntegration', () => {
    it('should delete integration successfully', async () => {
      Integrations.findOne.mockResolvedValue({ _id: mockIntegrationId });
      Integrations.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const result = await integrationService.deleteIntegration({
        integrationId: mockIntegrationId,
      });

      expect(result.deletedCount).toBe(1);
    });

    it('should throw error when delete fails', async () => {
      Integrations.findOne.mockResolvedValue({ _id: mockIntegrationId });
      Integrations.deleteOne.mockResolvedValue({ deletedCount: 0 });

      await expect(
        integrationService.deleteIntegration({
          integrationId: mockIntegrationId,
        })
      ).rejects.toThrow('FAILED_INTEGRATION_DELETE');
    });
  });

  describe('validateCredentials', () => {
    it('should validate credentials using provider factory', async () => {
      const mockIntegration = {
        _id: mockIntegrationId,
        provider: 'openai',
        apiKey: 'test-key',
      };
      const mockProvider = {
        validateCredentials: jest.fn().mockResolvedValue(true),
      };

      Integrations.findOne.mockResolvedValue(mockIntegration);
      ProviderFactory.createProvider.mockReturnValue(mockProvider);
      Integrations.findByIdAndUpdate.mockResolvedValue({});

      const result = await integrationService.validateCredentials({
        integrationId: mockIntegrationId,
      });

      expect(result).toBe(true);
      expect(ProviderFactory.createProvider).toHaveBeenCalledWith(
        mockIntegration
      );
      expect(Integrations.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          validationStatus: 'valid',
          lastValidatedAt: expect.any(Date),
        })
      );
    });

    it('should mark as invalid when validation fails', async () => {
      const mockIntegration = {
        _id: mockIntegrationId,
        provider: 'openai',
        apiKey: 'bad-key',
      };
      const mockProvider = {
        validateCredentials: jest.fn().mockResolvedValue(false),
      };

      Integrations.findOne.mockResolvedValue(mockIntegration);
      ProviderFactory.createProvider.mockReturnValue(mockProvider);
      Integrations.findByIdAndUpdate.mockResolvedValue({});

      const result = await integrationService.validateCredentials({
        integrationId: mockIntegrationId,
      });

      expect(result).toBe(false);
      expect(Integrations.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          validationStatus: 'invalid',
        })
      );
    });
  });

  describe('checkIfUserIsAuthorizedToAccessIntegration', () => {
    it('should allow access for admin user', async () => {
      const mockIntegration = {
        _id: mockIntegrationId,
        _company: mockGroupId,
      };
      const adminUser = { isAdmin: true };

      Integrations.findOne.mockResolvedValue(mockIntegration);

      const result = await integrationService.checkIfUserIsAuthorizedToAccessIntegration(
        {
          user: adminUser,
          integrationId: mockIntegrationId,
        }
      );

      expect(result).toEqual(mockIntegration);
    });

    it('should allow access for user in same group', async () => {
      const mockIntegration = {
        _id: mockIntegrationId,
        _company: new Types.ObjectId(mockGroupId),
      };
      const groupUser = {
        isAdmin: false,
        group: { id: mockGroupId },
      };

      Integrations.findOne.mockResolvedValue(mockIntegration);

      const result = await integrationService.checkIfUserIsAuthorizedToAccessIntegration(
        {
          user: groupUser,
          integrationId: mockIntegrationId,
        }
      );

      expect(result).toEqual(mockIntegration);
    });

    it('should deny access for user in different group', async () => {
      const differentGroupId = new Types.ObjectId().toString();
      const mockIntegration = {
        _id: mockIntegrationId,
        _company: new Types.ObjectId(differentGroupId),
      };
      const groupUser = {
        isAdmin: false,
        group: { id: mockGroupId },
      };

      Integrations.findOne.mockResolvedValue(mockIntegration);

      await expect(
        integrationService.checkIfUserIsAuthorizedToAccessIntegration({
          user: groupUser,
          integrationId: mockIntegrationId,
        })
      ).rejects.toThrow('FORBIDDEN_INTEGRATION_ACCESS');
    });
  });
});
