'use strict';

const jwt = require('jsonwebtoken');
const crmIntelligenceService = require('./crm-intelligence.service');
const GroupService = require('../group/group.service');
const { Groups } = require('../common/models.common');
const ERROR_CODES = require('../constant/error-codes');

// Mock the Group service and model
jest.mock('../group/group.service');
jest.mock('../common/models.common', () => ({
  Groups: {
    updateOne: jest.fn(),
  },
}));

// Valid MongoDB ObjectId for testing
const VALID_GROUP_ID = '507f1f77bcf86cd799439011';
const VALID_DASHBOARD_ID = '507f1f77bcf86cd799439022';

describe('CRM Intelligence Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getStatus', () => {
    it('should return enabled=false when CRM Intelligence is not enabled', async () => {
      GroupService.findById.mockResolvedValue({
        _id: 'group123',
        enableCrmIntelligence: false,
        metabaseConfig: null,
      });

      const result = await crmIntelligenceService.getStatus('group123');

      expect(result).toEqual({
        enabled: false,
        configured: false,
        dashboardCount: 0,
      });
    });

    it('should return enabled=true and configured=true when properly configured', async () => {
      GroupService.findById.mockResolvedValue({
        _id: 'group123',
        enableCrmIntelligence: true,
        metabaseConfig: {
          siteUrl: 'https://metabase.example.com',
          secretKey: 'secret-key-123',
          dashboards: [
            { metabaseId: 1, name: 'Dashboard 1' },
            { metabaseId: 2, name: 'Dashboard 2' },
          ],
        },
      });

      const result = await crmIntelligenceService.getStatus('group123');

      expect(result).toEqual({
        enabled: true,
        configured: true,
        dashboardCount: 2,
      });
    });

    it('should return configured=false when siteUrl is missing', async () => {
      GroupService.findById.mockResolvedValue({
        _id: 'group123',
        enableCrmIntelligence: true,
        metabaseConfig: {
          siteUrl: '',
          secretKey: 'secret-key-123',
          dashboards: [],
        },
      });

      const result = await crmIntelligenceService.getStatus('group123');

      expect(result).toEqual({
        enabled: true,
        configured: false,
        dashboardCount: 0,
      });
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
    it('should return sorted dashboards when enabled', async () => {
      GroupService.findById.mockResolvedValue({
        _id: 'group123',
        enableCrmIntelligence: true,
        metabaseConfig: {
          dashboards: [
            { _id: 'dash2', metabaseId: 2, name: 'Second', description: 'Desc 2', order: 2 },
            { _id: 'dash1', metabaseId: 1, name: 'First', description: 'Desc 1', order: 1 },
          ],
        },
      });

      const result = await crmIntelligenceService.getDashboards('group123');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('First');
      expect(result[1].name).toBe('Second');
      expect(result[0]).toHaveProperty('id', 'dash1');
      expect(result[0]).toHaveProperty('metabaseId', 1);
    });

    it('should throw 403 when CRM Intelligence is not enabled', async () => {
      GroupService.findById.mockResolvedValue({
        _id: 'group123',
        enableCrmIntelligence: false,
      });

      await expect(crmIntelligenceService.getDashboards('group123')).rejects.toThrow(
        expect.objectContaining({
          status: 403,
          message: ERROR_CODES.CRM_INTELLIGENCE_NOT_ENABLED,
        })
      );
    });

    it('should return empty array when no dashboards configured', async () => {
      GroupService.findById.mockResolvedValue({
        _id: 'group123',
        enableCrmIntelligence: true,
        metabaseConfig: {
          dashboards: [],
        },
      });

      const result = await crmIntelligenceService.getDashboards('group123');

      expect(result).toEqual([]);
    });
  });

  describe('getEmbedUrl', () => {
    const mockGroup = {
      _id: 'group123',
      enableCrmIntelligence: true,
      metabaseConfig: {
        siteUrl: 'https://metabase.example.com',
        secretKey: 'super-secret-key',
        dashboards: [
          {
            _id: { toString: () => 'dash123' },
            metabaseId: 42,
            name: 'Test Dashboard',
            lockedParams: { group_id: 'g123' },
          },
        ],
      },
    };

    it('should generate valid embed URL with JWT', async () => {
      GroupService.findById.mockResolvedValue(mockGroup);

      const result = await crmIntelligenceService.getEmbedUrl('group123', 'dash123');

      expect(result).toHaveProperty('embedUrl');
      expect(result).toHaveProperty('dashboardName', 'Test Dashboard');
      expect(result).toHaveProperty('expiresIn');
      expect(result.embedUrl).toContain('https://metabase.example.com/embed/dashboard/');
    });

    it('should create JWT with correct payload', async () => {
      GroupService.findById.mockResolvedValue(mockGroup);

      const result = await crmIntelligenceService.getEmbedUrl('group123', 'dash123');

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
        ...mockGroup,
        metabaseConfig: {
          ...mockGroup.metabaseConfig,
          dashboards: [],
        },
      });

      await expect(
        crmIntelligenceService.getEmbedUrl('group123', 'nonexistent')
      ).rejects.toThrow(
        expect.objectContaining({
          status: 404,
          message: ERROR_CODES.DASHBOARD_NOT_FOUND,
        })
      );
    });

    it('should throw 500 when Metabase config is missing', async () => {
      GroupService.findById.mockResolvedValue({
        _id: 'group123',
        enableCrmIntelligence: true,
        metabaseConfig: {
          siteUrl: '',
          secretKey: '',
          dashboards: [],
        },
      });

      await expect(
        crmIntelligenceService.getEmbedUrl('group123', 'dash123')
      ).rejects.toThrow(
        expect.objectContaining({
          status: 500,
          message: ERROR_CODES.CRM_INTELLIGENCE_NOT_CONFIGURED,
        })
      );
    });
  });

  describe('updateConfiguration', () => {
    it('should update enableCrmIntelligence flag', async () => {
      GroupService.findById.mockResolvedValue({
        _id: VALID_GROUP_ID,
        enableCrmIntelligence: false,
      });
      Groups.updateOne.mockResolvedValue({});

      await crmIntelligenceService.updateConfiguration(VALID_GROUP_ID, {
        enabled: true,
      });

      expect(Groups.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $set: expect.objectContaining({
            enableCrmIntelligence: true,
          }),
        })
      );
    });

    it('should update Metabase config', async () => {
      GroupService.findById.mockResolvedValue({
        _id: VALID_GROUP_ID,
        enableCrmIntelligence: true,
      });
      Groups.updateOne.mockResolvedValue({});

      await crmIntelligenceService.updateConfiguration(VALID_GROUP_ID, {
        siteUrl: 'https://new-metabase.com',
        secretKey: 'new-secret',
      });

      expect(Groups.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $set: expect.objectContaining({
            'metabaseConfig.siteUrl': 'https://new-metabase.com',
            'metabaseConfig.secretKey': 'new-secret',
          }),
        })
      );
    });

    it('should update dashboards', async () => {
      GroupService.findById.mockResolvedValue({
        _id: VALID_GROUP_ID,
        enableCrmIntelligence: true,
      });
      Groups.updateOne.mockResolvedValue({});

      await crmIntelligenceService.updateConfiguration(VALID_GROUP_ID, {
        dashboards: [
          { metabaseId: 1, name: 'Dashboard 1', order: 0 },
          { metabaseId: 2, name: 'Dashboard 2', order: 1 },
        ],
      });

      expect(Groups.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $set: expect.objectContaining({
            'metabaseConfig.dashboards': expect.arrayContaining([
              expect.objectContaining({ metabaseId: 1, name: 'Dashboard 1' }),
              expect.objectContaining({ metabaseId: 2, name: 'Dashboard 2' }),
            ]),
          }),
        })
      );
    });
  });

  describe('testConnection', () => {
    it('should return success when config is valid', async () => {
      GroupService.findById.mockResolvedValue({
        _id: 'group123',
        metabaseConfig: {
          siteUrl: 'https://metabase.example.com',
          secretKey: 'secret-key',
        },
      });

      const result = await crmIntelligenceService.testConnection('group123');

      expect(result).toEqual({
        success: true,
        message: 'Configuration looks valid',
      });
    });

    it('should return failure when URL is missing', async () => {
      GroupService.findById.mockResolvedValue({
        _id: 'group123',
        metabaseConfig: {
          siteUrl: '',
          secretKey: 'secret-key',
        },
      });

      const result = await crmIntelligenceService.testConnection('group123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Missing');
    });

    it('should return failure when URL format is invalid', async () => {
      GroupService.findById.mockResolvedValue({
        _id: 'group123',
        metabaseConfig: {
          siteUrl: 'not-a-valid-url',
          secretKey: 'secret-key',
        },
      });

      const result = await crmIntelligenceService.testConnection('group123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid');
    });

    it('should throw 404 when group not found', async () => {
      GroupService.findById.mockResolvedValue(null);

      await expect(
        crmIntelligenceService.testConnection('nonexistent')
      ).rejects.toThrow(
        expect.objectContaining({
          status: 404,
          message: ERROR_CODES.GROUP_NOT_FOUND,
        })
      );
    });
  });
});
