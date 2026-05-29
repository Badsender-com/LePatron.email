'use strict';

const jwt = require('jsonwebtoken');

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
jest.mock('../../../packages/server/dashboard/dashboard.service', () => ({
  listDashboards: jest.fn(),
}));

const crmIntelligenceService = require('../../../packages/server/crm-intelligence/crm-intelligence.service');
const DashboardService = require('../../../packages/server/dashboard/dashboard.service');
const {
  Integrations,
  Dashboards,
} = require('../../../packages/server/common/models.common');
const ERROR_CODES = require('../../../packages/server/constant/error-codes');

const VALID_GROUP_ID = '507f1f77bcf86cd799439011';
const VALID_DASHBOARD_ID = '507f1f77bcf86cd799439022';
const VALID_INTEGRATION_ID = '507f1f77bcf86cd799439033';

// HS256 needs ≥32 bytes; this is the boundary we enforce in the service.
const VALID_API_KEY = 'a-secret-key-that-is-32-chars-long-padding';

const GROUP_ENABLED = { _id: VALID_GROUP_ID, enableCrmIntelligence: true };
const GROUP_DISABLED = { _id: VALID_GROUP_ID, enableCrmIntelligence: false };

const baseIntegration = {
  _id: VALID_INTEGRATION_ID,
  name: 'Metabase Prod',
  provider: 'metabase',
  apiHost: 'https://metabase.example.com',
  apiKey: VALID_API_KEY,
  isActive: true,
};

const baseDashboard = {
  _id: VALID_DASHBOARD_ID,
  _integration: baseIntegration,
  providerDashboardId: 42,
  name: 'Sales Dashboard',
  lockedParams: { group_id: 'g123' },
};

describe('CRM Intelligence Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────
  describe('getStatus(groupId, group)', () => {
    it('returns enabled=false when CRM Intelligence is off — no DB calls', async () => {
      const result = await crmIntelligenceService.getStatus(
        VALID_GROUP_ID,
        GROUP_DISABLED
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

    it('returns enabled=true and configured=true when integrations and dashboards exist', async () => {
      Integrations.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([
          {
            _id: VALID_INTEGRATION_ID,
            name: 'Metabase Prod',
            provider: 'metabase',
          },
        ]),
      });
      Dashboards.countDocuments.mockResolvedValue(3);

      const result = await crmIntelligenceService.getStatus(
        VALID_GROUP_ID,
        GROUP_ENABLED
      );

      expect(result.enabled).toBe(true);
      expect(result.configured).toBe(true);
      expect(result.dashboardCount).toBe(3);
      expect(result.integrations).toHaveLength(1);
    });

    it('returns configured=false when integrations exist but no dashboards', async () => {
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
        GROUP_ENABLED
      );

      expect(result.configured).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  describe('getDashboards(groupId, group)', () => {
    it('returns dashboards when CRM Intelligence is enabled', async () => {
      DashboardService.listDashboards.mockResolvedValue([
        { id: 'dash1', name: 'Sales' },
      ]);

      const result = await crmIntelligenceService.getDashboards(
        VALID_GROUP_ID,
        GROUP_ENABLED
      );

      expect(result).toEqual([{ id: 'dash1', name: 'Sales' }]);
      expect(
        DashboardService.listDashboards
      ).toHaveBeenCalledWith(VALID_GROUP_ID, { activeOnly: true });
    });

    it('REJECTS with 403 when CRM Intelligence is disabled (defense in depth)', async () => {
      await expect(
        crmIntelligenceService.getDashboards(VALID_GROUP_ID, GROUP_DISABLED)
      ).rejects.toMatchObject({
        status: 403,
        message: ERROR_CODES.CRM_INTELLIGENCE_NOT_ENABLED,
      });
      expect(DashboardService.listDashboards).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  describe('getEmbedUrl(groupId, dashboardId, group, user) — M2/M3 hardening', () => {
    function mockDashboardLookup(dashboardOverrides = {}) {
      Dashboards.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          ...baseDashboard,
          ...dashboardOverrides,
        }),
      });
    }

    it('generates a Metabase embed URL with HS256-signed JWT', async () => {
      mockDashboardLookup();

      const result = await crmIntelligenceService.getEmbedUrl(
        VALID_GROUP_ID,
        VALID_DASHBOARD_ID,
        GROUP_ENABLED,
        { id: 'user-1', email: 'alice@example.com' }
      );

      expect(result.embedUrl).toContain(
        'https://metabase.example.com/embed/dashboard/'
      );
      expect(result).toHaveProperty('expiresIn');
    });

    it('M3: short-lived token (≤ 60s) limits replay window', async () => {
      mockDashboardLookup();
      const result = await crmIntelligenceService.getEmbedUrl(
        VALID_GROUP_ID,
        VALID_DASHBOARD_ID,
        GROUP_ENABLED,
        { id: 'user-1' }
      );
      expect(result.expiresIn).toBeLessThanOrEqual(60);
    });

    it('M3: binds user_id and user_email into JWT params when the dashboard declares them', async () => {
      // Dashboard opts into row-level filtering by declaring the slots.
      mockDashboardLookup({
        lockedParams: { group_id: 'g123', user_id: '', user_email: '' },
      });

      const result = await crmIntelligenceService.getEmbedUrl(
        VALID_GROUP_ID,
        VALID_DASHBOARD_ID,
        GROUP_ENABLED,
        { id: 'user-1', email: 'alice@example.com' }
      );

      const token = result.embedUrl.split('/embed/dashboard/')[1].split('#')[0];
      const decoded = jwt.verify(token, VALID_API_KEY);

      expect(decoded.params).toMatchObject({
        group_id: 'g123', // from lockedParams
        user_id: 'user-1',
        user_email: 'alice@example.com',
      });
    });

    it('does NOT inject user_id/user_email when the dashboard does not declare them (Metabase rejects unknown signed params with 400)', async () => {
      // baseDashboard only declares group_id.
      mockDashboardLookup();

      const result = await crmIntelligenceService.getEmbedUrl(
        VALID_GROUP_ID,
        VALID_DASHBOARD_ID,
        GROUP_ENABLED,
        { id: 'user-1', email: 'alice@example.com' }
      );

      const token = result.embedUrl.split('/embed/dashboard/')[1].split('#')[0];
      const decoded = jwt.verify(token, VALID_API_KEY);

      expect(decoded.params).toEqual({ group_id: 'g123' });
      expect(decoded.params.user_id).toBeUndefined();
      expect(decoded.params.user_email).toBeUndefined();
    });

    it('M3: fills only the declared user slot — user_id without user_email', async () => {
      mockDashboardLookup({
        lockedParams: { group_id: 'g123', user_id: '' },
      });
      const result = await crmIntelligenceService.getEmbedUrl(
        VALID_GROUP_ID,
        VALID_DASHBOARD_ID,
        GROUP_ENABLED,
        { id: 'user-1' }
      );
      const token = result.embedUrl.split('/embed/dashboard/')[1].split('#')[0];
      const decoded = jwt.verify(token, VALID_API_KEY);
      expect(decoded.params.user_id).toBe('user-1');
      expect(decoded.params.user_email).toBeUndefined();
    });

    it('M3: REJECTS apiKey shorter than 32 chars (regression: was < 10)', async () => {
      mockDashboardLookup({
        _integration: { ...baseIntegration, apiKey: 'too-short-key-only-20' },
      });

      await expect(
        crmIntelligenceService.getEmbedUrl(
          VALID_GROUP_ID,
          VALID_DASHBOARD_ID,
          GROUP_ENABLED,
          { id: 'user-1' }
        )
      ).rejects.toMatchObject({
        status: 500,
        message: ERROR_CODES.CRM_INTELLIGENCE_NOT_CONFIGURED,
      });
    });

    it('M2: REJECTS http:// apiHost (HTTPS-only enforcement)', async () => {
      mockDashboardLookup({
        _integration: {
          ...baseIntegration,
          apiHost: 'http://metabase.example.com',
        },
      });

      await expect(
        crmIntelligenceService.getEmbedUrl(
          VALID_GROUP_ID,
          VALID_DASHBOARD_ID,
          GROUP_ENABLED,
          { id: 'user-1' }
        )
      ).rejects.toMatchObject({
        status: 500,
        message: ERROR_CODES.CRM_INTELLIGENCE_NOT_CONFIGURED,
      });
    });

    it('M2: REJECTS malformed apiHost', async () => {
      mockDashboardLookup({
        _integration: {
          ...baseIntegration,
          apiHost: 'not-a-url',
        },
      });

      await expect(
        crmIntelligenceService.getEmbedUrl(
          VALID_GROUP_ID,
          VALID_DASHBOARD_ID,
          GROUP_ENABLED,
          { id: 'user-1' }
        )
      ).rejects.toMatchObject({
        status: 500,
        message: ERROR_CODES.CRM_INTELLIGENCE_NOT_CONFIGURED,
      });
    });

    it('M1: REJECTS with 403 when group has the flag off (defense in depth)', async () => {
      await expect(
        crmIntelligenceService.getEmbedUrl(
          VALID_GROUP_ID,
          VALID_DASHBOARD_ID,
          GROUP_DISABLED,
          { id: 'user-1' }
        )
      ).rejects.toMatchObject({
        status: 403,
        message: ERROR_CODES.CRM_INTELLIGENCE_NOT_ENABLED,
      });
    });

    it('returns 400 on invalid dashboard ID format', async () => {
      await expect(
        crmIntelligenceService.getEmbedUrl(
          VALID_GROUP_ID,
          'invalid-id',
          GROUP_ENABLED,
          { id: 'user-1' }
        )
      ).rejects.toMatchObject({
        status: 400,
        message: ERROR_CODES.DASHBOARD_NOT_FOUND,
      });
    });

    it('returns 404 when the dashboard does not exist or is inactive', async () => {
      Dashboards.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });
      await expect(
        crmIntelligenceService.getEmbedUrl(
          VALID_GROUP_ID,
          VALID_DASHBOARD_ID,
          GROUP_ENABLED,
          { id: 'user-1' }
        )
      ).rejects.toMatchObject({
        status: 404,
        message: ERROR_CODES.DASHBOARD_NOT_FOUND,
      });
    });

    it('returns 404 when the integration is inactive', async () => {
      mockDashboardLookup({
        _integration: { ...baseIntegration, isActive: false },
      });
      await expect(
        crmIntelligenceService.getEmbedUrl(
          VALID_GROUP_ID,
          VALID_DASHBOARD_ID,
          GROUP_ENABLED,
          { id: 'user-1' }
        )
      ).rejects.toMatchObject({
        status: 404,
        message: ERROR_CODES.INTEGRATION_NOT_FOUND,
      });
    });
  });
});
