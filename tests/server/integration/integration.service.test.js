'use strict';

const { Types } = require('mongoose');

// Mock dependencies before requiring the service
// Note: jest.mock calls are hoisted — string literals must be used, not variables
jest.mock('../../../packages/server/common/models.common', () => ({
  Integrations: {
    create: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    deleteOne: jest.fn(),
    exists: jest.fn(),
  },
  Dashboards: {
    deleteMany: jest.fn(),
  },
}));

jest.mock('../../../packages/server/group/group.service', () => ({
  findById: jest.fn(),
}));

jest.mock(
  '../../../packages/server/integration-providers/provider-factory',
  () => ({
    createProvider: jest.fn(),
  })
);

const integrationService = require('../../../packages/server/integration/integration.service');
const {
  Integrations,
  Dashboards,
} = require('../../../packages/server/common/models.common');
const groupService = require('../../../packages/server/group/group.service');
const ProviderFactory = require('../../../packages/server/integration-providers/provider-factory');

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

  describe('findById', () => {
    it('should return integration when found', async () => {
      const mockIntegration = {
        _id: mockIntegrationId,
        name: 'Test Integration',
      };

      Integrations.findById.mockResolvedValue(mockIntegration);

      const result = await integrationService.findById(mockIntegrationId);

      expect(result).toEqual(mockIntegration);
    });

    it('should throw NotFound when integration does not exist', async () => {
      Integrations.findById.mockResolvedValue(null);

      await expect(
        integrationService.findById(mockIntegrationId)
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

  // Infomaniak builds the path the API key is sent to from productId.
  describe('productId', () => {
    function arrangeCreate() {
      Integrations.exists.mockResolvedValue(false);
      Integrations.create.mockImplementation(async (data) => data);
    }

    function create(productId) {
      return integrationService.createIntegration({
        name: 'Infomaniak',
        type: 'ai',
        provider: 'infomaniak',
        apiKey: 'key',
        productId,
        _company: mockGroupId,
      });
    }

    it('keeps a numeric id, trimmed', async () => {
      arrangeCreate();

      const result = await create(' 104807 ');

      expect(result.productId).toBe('104807');
    });

    it('stores null rather than an empty string', async () => {
      arrangeCreate();

      const result = await create('');

      expect(result.productId).toBeNull();
    });

    it.each([['../../2/profile?x='], ['104807/'], ['12 34'], ['abc']])(
      'rejects %j',
      async (productId) => {
        arrangeCreate();

        await expect(create(productId)).rejects.toThrow('INVALID_PRODUCT_ID');
        expect(Integrations.create).not.toHaveBeenCalled();
      }
    );

    it('rejects it on update too', async () => {
      const existingIntegration = {
        _id: mockIntegrationId,
        name: 'Infomaniak',
        type: 'ai',
        _company: mockGroupId,
        save: jest.fn().mockResolvedValue(),
      };
      Integrations.findById.mockResolvedValue(existingIntegration);

      await expect(
        integrationService.updateIntegration({
          integrationId: mockIntegrationId,
          productId: '../x',
        })
      ).rejects.toThrow('INVALID_PRODUCT_ID');
      expect(existingIntegration.save).not.toHaveBeenCalled();
    });
  });

  describe('updateIntegration', () => {
    it('should update integration fields', async () => {
      const existingIntegration = {
        _id: mockIntegrationId,
        name: 'Old Name',
        type: 'ai',
        _company: mockGroupId,
        save: jest.fn().mockResolvedValue(),
      };

      Integrations.findById.mockResolvedValue(existingIntegration);
      Integrations.exists.mockResolvedValue(false);

      const result = await integrationService.updateIntegration({
        integrationId: mockIntegrationId,
        name: 'New Name',
      });

      expect(existingIntegration.save).toHaveBeenCalled();
      expect(result.name).toBe('New Name');
    });

    it('should reset validation status when API key changes', async () => {
      const existingIntegration = {
        _id: mockIntegrationId,
        name: 'Test',
        type: 'ai',
        _company: mockGroupId,
        apiKey: 'old-key',
        save: jest.fn().mockResolvedValue(),
      };

      Integrations.findById.mockResolvedValue(existingIntegration);

      await integrationService.updateIntegration({
        integrationId: mockIntegrationId,
        apiKey: 'new-key',
      });

      expect(existingIntegration.save).toHaveBeenCalled();
      expect(existingIntegration.apiKey).toBe('new-key');
      expect(existingIntegration.validationStatus).toBe('pending');
      expect(existingIntegration.lastValidatedAt).toBeNull();
    });
  });

  // The stored key is sent to whatever host the integration names: moving it
  // elsewhere must require knowing it.
  describe('changing where a stored key is sent', () => {
    function stored(overrides = {}) {
      const integration = {
        _id: mockIntegrationId,
        name: 'Endpoint',
        type: 'ai',
        provider: 'openai_compatible',
        apiHost: 'https://93.184.216.34',
        apiKey: 'stored-secret',
        _company: mockGroupId,
        save: jest.fn().mockResolvedValue(),
        ...overrides,
      };
      Integrations.findById.mockResolvedValue(integration);
      return integration;
    }

    function update(fields) {
      return integrationService.updateIntegration({
        integrationId: mockIntegrationId,
        ...fields,
      });
    }

    it('refuses a new host without the key', async () => {
      const integration = stored();

      await expect(update({ apiHost: 'https://1.1.1.1' })).rejects.toThrow(
        'INTEGRATION_API_KEY_REQUIRED'
      );
      expect(integration.save).not.toHaveBeenCalled();
    });

    it('refuses a new provider without the key', async () => {
      const integration = stored({ provider: 'deepl', apiHost: null });

      await expect(update({ provider: 'openai_compatible' })).rejects.toThrow(
        'INTEGRATION_API_KEY_REQUIRED'
      );
      expect(integration.save).not.toHaveBeenCalled();
    });

    it('accepts a new host when the key comes with it', async () => {
      const integration = stored();

      await update({ apiHost: 'https://8.8.8.8', apiKey: 'new-key' });

      expect(integration.save).toHaveBeenCalled();
      expect(integration.apiHost).toBe('https://8.8.8.8');
    });

    // The form sends the host back on every save.
    it('accepts the same host sent back unchanged', async () => {
      const integration = stored();

      await update({ apiHost: 'https://93.184.216.34', name: 'Renamed' });

      expect(integration.save).toHaveBeenCalled();
    });

    // Only reachable through the API: the form locks the provider on edit.
    it('drops the previous provider settings when the provider changes', async () => {
      const integration = stored({
        provider: 'azure_openai',
        config: { deployment: 'prod-chat', reasoningModel: true },
      });

      await update({ provider: 'openai_compatible', apiKey: 'new-key' });

      expect(integration.config).toEqual({});
    });

    it('checks a config sent with a new provider against that provider', async () => {
      stored({ provider: 'azure_openai' });

      await expect(
        update({
          provider: 'openai_compatible',
          apiKey: 'new-key',
          config: { deployment: 'prod-chat' },
        })
      ).rejects.toThrow('INTEGRATION_CONFIG_INVALID');
    });

    it('does not ask for a key when none is stored (public RSS feed)', async () => {
      const integration = stored({
        type: 'data_feed',
        provider: 'rss',
        apiKey: undefined,
        apiHost: 'https://1.0.0.1/feed',
      });

      await update({ apiHost: 'https://1.0.0.1/other-feed' });

      expect(integration.save).toHaveBeenCalled();
    });
  });

  // A key (AI) or a signed token (Metabase) is sent to the host: over http it
  // travels in clear. A public RSS feed sends nothing. Literal public IPs, so
  // the SSRF guard needs no DNS.
  describe('https for the types that send a secret', () => {
    function create(type, provider, apiHost) {
      Integrations.exists.mockResolvedValue(false);
      Integrations.create.mockImplementation(async (data) => data);
      return integrationService.createIntegration({
        name: 'x',
        type,
        provider,
        apiKey: 'k'.repeat(32),
        apiHost,
        _company: mockGroupId,
      });
    }

    it.each([
      ['ai', 'openai_compatible'],
      ['dashboard', 'metabase'],
    ])('refuses http for %s', async (type, provider) => {
      await expect(
        create(type, provider, 'http://93.184.216.34')
      ).rejects.toThrow('INTEGRATION_HOST_HTTPS_REQUIRED');
      expect(Integrations.create).not.toHaveBeenCalled();
    });

    it('accepts https for ai', async () => {
      await create('ai', 'openai_compatible', 'https://93.184.216.34');

      expect(Integrations.create).toHaveBeenCalled();
    });

    it('accepts http for a public RSS feed', async () => {
      await create('data_feed', 'rss', 'http://93.184.216.34/feed.xml');

      expect(Integrations.create).toHaveBeenCalled();
    });

    // The address is what cannot be fixed by switching to https.
    it('reports a private http host as private, not as needing https', async () => {
      await expect(
        create('ai', 'openai_compatible', 'http://10.0.0.5')
      ).rejects.toThrow('INTEGRATION_HOST_NOT_PUBLIC');
    });

    // Saved before the rule: must stay editable without touching the host.
    it('lets an existing http integration be renamed', async () => {
      const integration = {
        _id: mockIntegrationId,
        name: 'Old',
        type: 'ai',
        provider: 'openai_compatible',
        apiHost: 'http://93.184.216.34',
        apiKey: 'stored',
        _company: mockGroupId,
        save: jest.fn().mockResolvedValue(),
      };
      Integrations.findById.mockResolvedValue(integration);
      Integrations.exists.mockResolvedValue(false);

      await integrationService.updateIntegration({
        integrationId: mockIntegrationId,
        name: 'New',
        apiHost: 'http://93.184.216.34',
      });

      expect(integration.save).toHaveBeenCalled();
    });

    it('refuses to move an existing integration to an http host', async () => {
      const integration = {
        _id: mockIntegrationId,
        name: 'Old',
        type: 'ai',
        provider: 'openai_compatible',
        apiHost: 'https://93.184.216.34',
        apiKey: 'stored',
        _company: mockGroupId,
        save: jest.fn().mockResolvedValue(),
      };
      Integrations.findById.mockResolvedValue(integration);

      await expect(
        integrationService.updateIntegration({
          integrationId: mockIntegrationId,
          apiHost: 'http://8.8.8.8',
          apiKey: 'new-key',
        })
      ).rejects.toThrow('INTEGRATION_HOST_HTTPS_REQUIRED');
      expect(integration.save).not.toHaveBeenCalled();
    });
  });

  describe('deleteIntegration', () => {
    it('should delete integration successfully', async () => {
      Integrations.findById.mockResolvedValue({ _id: mockIntegrationId });
      Dashboards.deleteMany.mockResolvedValue({ deletedCount: 0 });
      Integrations.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const result = await integrationService.deleteIntegration({
        integrationId: mockIntegrationId,
      });

      expect(result.deletedCount).toBe(1);
    });

    it('should throw error when delete fails', async () => {
      Integrations.findById.mockResolvedValue({ _id: mockIntegrationId });
      Dashboards.deleteMany.mockResolvedValue({ deletedCount: 0 });
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

      Integrations.findById.mockResolvedValue(mockIntegration);
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

      Integrations.findById.mockResolvedValue(mockIntegration);
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

      Integrations.findById.mockResolvedValue(mockIntegration);

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

      Integrations.findById.mockResolvedValue(mockIntegration);

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

      Integrations.findById.mockResolvedValue(mockIntegration);

      await expect(
        integrationService.checkIfUserIsAuthorizedToAccessIntegration({
          user: groupUser,
          integrationId: mockIntegrationId,
        })
      ).rejects.toThrow('FORBIDDEN_INTEGRATION_ACCESS');
    });
  });
});
