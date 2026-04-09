'use strict';

const jwt = require('jsonwebtoken');

// Mock dependencies — jest.mock calls are hoisted, string literals required
jest.mock('../../../packages/server/common/models.common', () => ({
  Integrations: {
    find: jest.fn(),
  },
  Dashboards: {
    find: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

const crmIntelligenceService = require('../../../packages/server/crm-intelligence/crm-intelligence.service');
const {
  Integrations,
  Dashboards,
} = require('../../../packages/server/common/models.common');
const ERROR_CODES = require('../../../packages/server/constant/error-codes');

// Valid MongoDB ObjectIds for testing
const VALID_GROUP_ID = '507f1f77bcf86cd799439011';
const VALID_DASHBOARD_ID = '507f1f77bcf86cd799439022';
const VALID_INTEGRATION_ID = '507f1f77bcf86cd799439033';

describe('CRM Intelligence Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getStatus', () => {
    it('should return enabled=false when CRM Intelligence is not enabled', async () => {
      const group = { enableCrmIntelligence: false };

      const result = await crmIntelligenceService.getStatus(
        VALID_GROUP_ID,
        group
      );

      expect(result).toEqual({
        enabled: false,
        configured: false,
        dashboardCount: 0,
        integrations: [],
      });
      expect(Integrations.find).not.toHaveBeenCalled();
      expect(Dashboards.countDocuments).not.toHaveBeenCalled();
    });

    it('should return enabled=true and configured=true when integrations and dashboards exist', async () => {
      const group = { enableCrmIntelligence: true };

      const mockIntegrations = [
        {
          _id: VALID_INTEGRATION_ID,
          name: 'Metabase Prod',
          provider: 'metabase',
        },
      ];
      Integrations.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockIntegrations),
      });
      Dashboards.countDocuments.mockResolvedValue(3);

      const result = await crmIntelligenceService.getStatus(
        VALID_GROUP_ID,
        group
      );

      expect(result).toEqual({
        enabled: true,
        configured: true,
        dashboardCount: 3,
        integrations: [
          {
            id: VALID_INTEGRATION_ID,
            name: 'Metabase Prod',
            provider: 'metabase',
          },
        ],
      });
    });

    it('should return configured=false when no integrations exist', async () => {
      const group = { enableCrmIntelligence: true };

      Integrations.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });
      Dashboards.countDocuments.mockResolvedValue(0);

      const result = await crmIntelligenceService.getStatus(
        VALID_GROUP_ID,
        group
      );

      expect(result).toEqual({
        enabled: true,
        configured: false,
        dashboardCount: 0,
        integrations: [],
      });
    });

    it('should return configured=false when integrations exist but no dashboards', async () => {
      const group = { enableCrmIntelligence: true };

      Integrations.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([
          {
            _id: VALID_INTEGRATION_ID,
            name: 'Metabase',
            provider: 'metabase',
          },
        ]),
      });
      Dashboards.countDocuments.mockResolvedValue(0);

      const result = await crmIntelligenceService.getStatus(
        VALID_GROUP_ID,
        group
      );

      expect(result.configured).toBe(false);
    });
  });

  describe('getDashboards', () => {
    const enabledGroup = { enableCrmIntelligence: true };
    const disabledGroup = { enableCrmIntelligence: false };

    it('should return dashboards with integration info', async () => {
      const mockDashboards = [
        {
          _id: { toString: () => 'dash1' },
          _integration: {
            _id: { toString: () => VALID_INTEGRATION_ID },
            name: 'Metabase Prod',
            provider: 'metabase',
          },
          providerDashboardId: 42,
          name: 'Sales Dashboard',
          description: 'Sales metrics',
          order: 0,
        },
        {
          _id: { toString: () => 'dash2' },
          _integration: {
            _id: { toString: () => VALID_INTEGRATION_ID },
            name: 'Metabase Prod',
            provider: 'metabase',
          },
          providerDashboardId: 43,
          name: 'Marketing Dashboard',
          description: 'Marketing KPIs',
          order: 1,
        },
      ];

      Dashboards.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockDashboards),
          }),
        }),
      });

      const result = await crmIntelligenceService.getDashboards(
        VALID_GROUP_ID,
        enabledGroup
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'dash1',
        name: 'Sales Dashboard',
        description: 'Sales metrics',
        providerDashboardId: 42,
        order: 0,
        isActive: undefined,
        lockedParams: undefined,
        integration: {
          id: VALID_INTEGRATION_ID,
          name: 'Metabase Prod',
          provider: 'metabase',
          apiHost: undefined,
        },
        createdAt: undefined,
        updatedAt: undefined,
      });
    });

    it('should throw 403 when CRM Intelligence is not enabled', async () => {
      await expect(
        crmIntelligenceService.getDashboards(VALID_GROUP_ID, disabledGroup)
      ).rejects.toThrow(
        expect.objectContaining({
          status: 403,
          message: ERROR_CODES.CRM_INTELLIGENCE_NOT_ENABLED,
        })
      );
    });

    it('should return empty array when no dashboards configured', async () => {
      Dashboards.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await crmIntelligenceService.getDashboards(
        VALID_GROUP_ID,
        enabledGroup
      );

      expect(result).toEqual([]);
    });
  });

  describe('getEmbedUrl', () => {
    const enabledGroup = { enableCrmIntelligence: true };
    const disabledGroup = { enableCrmIntelligence: false };

    const mockIntegration = {
      _id: VALID_INTEGRATION_ID,
      name: 'Metabase Prod',
      provider: 'metabase',
      apiHost: 'https://metabase.example.com',
      apiKey: 'super-secret-key',
      isActive: true,
    };

    const mockDashboard = {
      _id: VALID_DASHBOARD_ID,
      _integration: mockIntegration,
      providerDashboardId: 42,
      name: 'Sales Dashboard',
      lockedParams: { group_id: 'g123' },
    };

    it('should generate valid embed URL with JWT', async () => {
      Dashboards.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockDashboard),
      });

      const result = await crmIntelligenceService.getEmbedUrl(
        VALID_GROUP_ID,
        VALID_DASHBOARD_ID,
        enabledGroup
      );

      expect(result).toHaveProperty('embedUrl');
      expect(result).toHaveProperty('dashboardName', 'Sales Dashboard');
      expect(result).toHaveProperty('integrationName', 'Metabase Prod');
      expect(result).toHaveProperty('expiresIn');
      expect(result.embedUrl).toContain(
        'https://metabase.example.com/embed/dashboard/'
      );
    });

    it('should create JWT with correct payload', async () => {
      Dashboards.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockDashboard),
      });

      const result = await crmIntelligenceService.getEmbedUrl(
        VALID_GROUP_ID,
        VALID_DASHBOARD_ID,
        enabledGroup
      );

      // Extract and decode the JWT from the URL
      const urlParts = result.embedUrl.split('/embed/dashboard/');
      const tokenWithHash = urlParts[1];
      const token = tokenWithHash.split('#')[0];

      const decoded = jwt.verify(token, 'super-secret-key');

      expect(decoded).toHaveProperty('resource');
      expect(decoded.resource).toEqual({ dashboard: 42 });
      expect(decoded).toHaveProperty('params');
      expect(decoded.params).toEqual({ group_id: 'g123' });
      expect(decoded).toHaveProperty('exp');
    });

    it('should throw 404 when dashboard not found', async () => {
      Dashboards.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      await expect(
        crmIntelligenceService.getEmbedUrl(
          VALID_GROUP_ID,
          VALID_DASHBOARD_ID,
          enabledGroup
        )
      ).rejects.toThrow(
        expect.objectContaining({
          status: 404,
          message: ERROR_CODES.DASHBOARD_NOT_FOUND,
        })
      );
    });

    it('should throw 404 when integration not found', async () => {
      Dashboards.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          ...mockDashboard,
          _integration: null,
        }),
      });

      await expect(
        crmIntelligenceService.getEmbedUrl(
          VALID_GROUP_ID,
          VALID_DASHBOARD_ID,
          enabledGroup
        )
      ).rejects.toThrow(
        expect.objectContaining({
          status: 404,
          message: ERROR_CODES.INTEGRATION_NOT_FOUND,
        })
      );
    });

    it('should throw 404 when integration is inactive', async () => {
      Dashboards.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          ...mockDashboard,
          _integration: { ...mockIntegration, isActive: false },
        }),
      });

      await expect(
        crmIntelligenceService.getEmbedUrl(
          VALID_GROUP_ID,
          VALID_DASHBOARD_ID,
          enabledGroup
        )
      ).rejects.toThrow(
        expect.objectContaining({
          status: 404,
          message: ERROR_CODES.INTEGRATION_NOT_FOUND,
        })
      );
    });

    it('should throw 500 when integration config is missing', async () => {
      Dashboards.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          ...mockDashboard,
          _integration: { ...mockIntegration, apiHost: '', apiKey: '' },
        }),
      });

      await expect(
        crmIntelligenceService.getEmbedUrl(
          VALID_GROUP_ID,
          VALID_DASHBOARD_ID,
          enabledGroup
        )
      ).rejects.toThrow(
        expect.objectContaining({
          status: 500,
          message: ERROR_CODES.CRM_INTELLIGENCE_NOT_CONFIGURED,
        })
      );
    });

    it('should throw 403 when CRM Intelligence is not enabled', async () => {
      await expect(
        crmIntelligenceService.getEmbedUrl(
          VALID_GROUP_ID,
          VALID_DASHBOARD_ID,
          disabledGroup
        )
      ).rejects.toThrow(
        expect.objectContaining({
          status: 403,
          message: ERROR_CODES.CRM_INTELLIGENCE_NOT_ENABLED,
        })
      );
    });

    it('should throw 400 for invalid dashboard ID format', async () => {
      await expect(
        crmIntelligenceService.getEmbedUrl(
          VALID_GROUP_ID,
          'invalid-id',
          enabledGroup
        )
      ).rejects.toThrow(
        expect.objectContaining({
          status: 400,
          message: ERROR_CODES.DASHBOARD_NOT_FOUND,
        })
      );
    });
  });
});
