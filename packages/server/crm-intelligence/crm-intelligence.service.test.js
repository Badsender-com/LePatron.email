'use strict';

const jwt = require('jsonwebtoken');
const crmIntelligenceService = require('./crm-intelligence.service');
const GroupService = require('../group/group.service');
const { Integrations, Dashboards } = require('../common/models.common');
const ERROR_CODES = require('../constant/error-codes');
const IntegrationTypes = require('../constant/integration-type');

// Mock dependencies
jest.mock('../group/group.service');
jest.mock('../common/models.common', () => ({
  Integrations: {
    find: jest.fn(),
  },
  Dashboards: {
    find: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

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
      GroupService.findById.mockResolvedValue({
        _id: VALID_GROUP_ID,
        enableCrmIntelligence: false,
      });

      const result = await crmIntelligenceService.getStatus(VALID_GROUP_ID);

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
      GroupService.findById.mockResolvedValue({
        _id: VALID_GROUP_ID,
        enableCrmIntelligence: true,
      });

      const mockIntegrations = [
        { _id: VALID_INTEGRATION_ID, name: 'Metabase Prod', provider: 'metabase' },
      ];
      Integrations.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockIntegrations),
      });
      Dashboards.countDocuments.mockResolvedValue(3);

      const result = await crmIntelligenceService.getStatus(VALID_GROUP_ID);

      expect(result).toEqual({
        enabled: true,
        configured: true,
        dashboardCount: 3,
        integrations: [
          { id: VALID_INTEGRATION_ID, name: 'Metabase Prod', provider: 'metabase' },
        ],
      });
    });

    it('should return configured=false when no integrations exist', async () => {
      GroupService.findById.mockResolvedValue({
        _id: VALID_GROUP_ID,
        enableCrmIntelligence: true,
      });

      Integrations.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });
      Dashboards.countDocuments.mockResolvedValue(0);

      const result = await crmIntelligenceService.getStatus(VALID_GROUP_ID);

      expect(result).toEqual({
        enabled: true,
        configured: false,
        dashboardCount: 0,
        integrations: [],
      });
    });

    it('should return configured=false when integrations exist but no dashboards', async () => {
      GroupService.findById.mockResolvedValue({
        _id: VALID_GROUP_ID,
        enableCrmIntelligence: true,
      });

      Integrations.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([
          { _id: VALID_INTEGRATION_ID, name: 'Metabase', provider: 'metabase' },
        ]),
      });
      Dashboards.countDocuments.mockResolvedValue(0);

      const result = await crmIntelligenceService.getStatus(VALID_GROUP_ID);

      expect(result.configured).toBe(false);
    });

    it('should throw 404 when group not found', async () => {
      GroupService.findById.mockResolvedValue(null);

      await expect(crmIntelligenceService.getStatus('nonexistent')).rejects.toThrow(
        expect.objectContaining({
          status: 404,
          message: ERROR_CODES.GROUP_NOT_FOUND,
        })
      );
    });
  });

  describe('getDashboards', () => {
    it('should return dashboards with integration info', async () => {
      GroupService.findById.mockResolvedValue({
        _id: VALID_GROUP_ID,
        enableCrmIntelligence: true,
      });

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

      const result = await crmIntelligenceService.getDashboards(VALID_GROUP_ID);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'dash1',
        integrationId: VALID_INTEGRATION_ID,
        integrationName: 'Metabase Prod',
        provider: 'metabase',
        providerDashboardId: 42,
        name: 'Sales Dashboard',
        description: 'Sales metrics',
        order: 0,
      });
    });

    it('should throw 403 when CRM Intelligence is not enabled', async () => {
      GroupService.findById.mockResolvedValue({
        _id: VALID_GROUP_ID,
        enableCrmIntelligence: false,
      });

      await expect(crmIntelligenceService.getDashboards(VALID_GROUP_ID)).rejects.toThrow(
        expect.objectContaining({
          status: 403,
          message: ERROR_CODES.CRM_INTELLIGENCE_NOT_ENABLED,
        })
      );
    });

    it('should throw 404 when group not found', async () => {
      GroupService.findById.mockResolvedValue(null);

      await expect(crmIntelligenceService.getDashboards('nonexistent')).rejects.toThrow(
        expect.objectContaining({
          status: 404,
          message: ERROR_CODES.GROUP_NOT_FOUND,
        })
      );
    });

    it('should return empty array when no dashboards configured', async () => {
      GroupService.findById.mockResolvedValue({
        _id: VALID_GROUP_ID,
        enableCrmIntelligence: true,
      });

      Dashboards.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await crmIntelligenceService.getDashboards(VALID_GROUP_ID);

      expect(result).toEqual([]);
    });
  });

  describe('getEmbedUrl', () => {
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
      GroupService.findById.mockResolvedValue({
        _id: VALID_GROUP_ID,
        enableCrmIntelligence: true,
      });

      Dashboards.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockDashboard),
      });

      const result = await crmIntelligenceService.getEmbedUrl(
        VALID_GROUP_ID,
        VALID_DASHBOARD_ID
      );

      expect(result).toHaveProperty('embedUrl');
      expect(result).toHaveProperty('dashboardName', 'Sales Dashboard');
      expect(result).toHaveProperty('integrationName', 'Metabase Prod');
      expect(result).toHaveProperty('expiresIn');
      expect(result.embedUrl).toContain('https://metabase.example.com/embed/dashboard/');
    });

    it('should create JWT with correct payload', async () => {
      GroupService.findById.mockResolvedValue({
        _id: VALID_GROUP_ID,
        enableCrmIntelligence: true,
      });

      Dashboards.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockDashboard),
      });

      const result = await crmIntelligenceService.getEmbedUrl(
        VALID_GROUP_ID,
        VALID_DASHBOARD_ID
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
      GroupService.findById.mockResolvedValue({
        _id: VALID_GROUP_ID,
        enableCrmIntelligence: true,
      });

      Dashboards.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      await expect(
        crmIntelligenceService.getEmbedUrl(VALID_GROUP_ID, VALID_DASHBOARD_ID)
      ).rejects.toThrow(
        expect.objectContaining({
          status: 404,
          message: ERROR_CODES.DASHBOARD_NOT_FOUND,
        })
      );
    });

    it('should throw 404 when integration not found', async () => {
      GroupService.findById.mockResolvedValue({
        _id: VALID_GROUP_ID,
        enableCrmIntelligence: true,
      });

      Dashboards.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          ...mockDashboard,
          _integration: null,
        }),
      });

      await expect(
        crmIntelligenceService.getEmbedUrl(VALID_GROUP_ID, VALID_DASHBOARD_ID)
      ).rejects.toThrow(
        expect.objectContaining({
          status: 404,
          message: ERROR_CODES.INTEGRATION_NOT_FOUND,
        })
      );
    });

    it('should throw 404 when integration is inactive', async () => {
      GroupService.findById.mockResolvedValue({
        _id: VALID_GROUP_ID,
        enableCrmIntelligence: true,
      });

      Dashboards.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          ...mockDashboard,
          _integration: { ...mockIntegration, isActive: false },
        }),
      });

      await expect(
        crmIntelligenceService.getEmbedUrl(VALID_GROUP_ID, VALID_DASHBOARD_ID)
      ).rejects.toThrow(
        expect.objectContaining({
          status: 404,
          message: ERROR_CODES.INTEGRATION_NOT_FOUND,
        })
      );
    });

    it('should throw 500 when integration config is missing', async () => {
      GroupService.findById.mockResolvedValue({
        _id: VALID_GROUP_ID,
        enableCrmIntelligence: true,
      });

      Dashboards.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          ...mockDashboard,
          _integration: { ...mockIntegration, apiHost: '', apiKey: '' },
        }),
      });

      await expect(
        crmIntelligenceService.getEmbedUrl(VALID_GROUP_ID, VALID_DASHBOARD_ID)
      ).rejects.toThrow(
        expect.objectContaining({
          status: 500,
          message: ERROR_CODES.CRM_INTELLIGENCE_NOT_CONFIGURED,
        })
      );
    });

    it('should throw 403 when CRM Intelligence is not enabled', async () => {
      GroupService.findById.mockResolvedValue({
        _id: VALID_GROUP_ID,
        enableCrmIntelligence: false,
      });

      await expect(
        crmIntelligenceService.getEmbedUrl(VALID_GROUP_ID, VALID_DASHBOARD_ID)
      ).rejects.toThrow(
        expect.objectContaining({
          status: 403,
          message: ERROR_CODES.CRM_INTELLIGENCE_NOT_ENABLED,
        })
      );
    });

    it('should throw 400 for invalid dashboard ID format', async () => {
      GroupService.findById.mockResolvedValue({
        _id: VALID_GROUP_ID,
        enableCrmIntelligence: true,
      });

      await expect(
        crmIntelligenceService.getEmbedUrl(VALID_GROUP_ID, 'invalid-id')
      ).rejects.toThrow(
        expect.objectContaining({
          status: 400,
          message: ERROR_CODES.DASHBOARD_NOT_FOUND,
        })
      );
    });
  });
});
