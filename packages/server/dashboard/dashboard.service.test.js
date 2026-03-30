'use strict';

const dashboardService = require('./dashboard.service');
const { Dashboards, Integrations } = require('../common/models.common');
const ERROR_CODES = require('../constant/error-codes');

// Mock dependencies
jest.mock('../common/models.common', () => ({
  Dashboards: {
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    deleteOne: jest.fn(),
    bulkWrite: jest.fn(),
  },
  Integrations: {
    findOne: jest.fn(),
  },
}));

// Valid MongoDB ObjectIds for testing
const VALID_GROUP_ID = '507f1f77bcf86cd799439011';
const VALID_DASHBOARD_ID = '507f1f77bcf86cd799439022';
const VALID_INTEGRATION_ID = '507f1f77bcf86cd799439033';

describe('Dashboard Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listDashboards', () => {
    it('should return formatted dashboards list sorted by order', async () => {
      const mockDashboards = [
        {
          _id: { toString: () => 'dash1' },
          name: 'Sales Dashboard',
          description: 'Sales metrics',
          providerDashboardId: 42,
          order: 0,
          isActive: true,
          lockedParams: { group_id: 'g1' },
          _integration: {
            _id: { toString: () => VALID_INTEGRATION_ID },
            name: 'Metabase Prod',
            provider: 'metabase',
            apiHost: 'https://metabase.example.com',
          },
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
        },
        {
          _id: { toString: () => 'dash2' },
          name: 'Marketing Dashboard',
          description: 'Marketing KPIs',
          providerDashboardId: 43,
          order: 1,
          isActive: true,
          lockedParams: {},
          _integration: {
            _id: { toString: () => VALID_INTEGRATION_ID },
            name: 'Metabase Prod',
            provider: 'metabase',
            apiHost: 'https://metabase.example.com',
          },
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
        },
      ];

      Dashboards.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockDashboards),
          }),
        }),
      });

      const result = await dashboardService.listDashboards(VALID_GROUP_ID);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'dash1',
        name: 'Sales Dashboard',
        description: 'Sales metrics',
        providerDashboardId: 42,
        order: 0,
        isActive: true,
        lockedParams: { group_id: 'g1' },
      });
      expect(result[0].integration).toMatchObject({
        id: VALID_INTEGRATION_ID,
        name: 'Metabase Prod',
        provider: 'metabase',
      });
    });

    it('should return empty array when no dashboards exist', async () => {
      Dashboards.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await dashboardService.listDashboards(VALID_GROUP_ID);

      expect(result).toEqual([]);
    });

    it('should handle dashboards without integration', async () => {
      const mockDashboards = [
        {
          _id: { toString: () => 'dash1' },
          name: 'Orphan Dashboard',
          description: '',
          providerDashboardId: 1,
          order: 0,
          isActive: true,
          lockedParams: {},
          _integration: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      Dashboards.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockDashboards),
          }),
        }),
      });

      const result = await dashboardService.listDashboards(VALID_GROUP_ID);

      expect(result[0].integration).toBeNull();
    });
  });

  describe('getDashboard', () => {
    it('should return formatted dashboard by ID', async () => {
      const mockDashboard = {
        _id: { toString: () => VALID_DASHBOARD_ID },
        name: 'Sales Dashboard',
        description: 'Sales metrics',
        providerDashboardId: 42,
        order: 0,
        isActive: true,
        lockedParams: {},
        _company: { toString: () => VALID_GROUP_ID },
        _integration: {
          _id: { toString: () => VALID_INTEGRATION_ID },
          name: 'Metabase Prod',
          provider: 'metabase',
          apiHost: 'https://metabase.example.com',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      Dashboards.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockDashboard),
        }),
      });

      const result = await dashboardService.getDashboard(VALID_DASHBOARD_ID);

      expect(result).toMatchObject({
        id: VALID_DASHBOARD_ID,
        name: 'Sales Dashboard',
        groupId: VALID_GROUP_ID,
      });
    });

    it('should throw 404 when dashboard not found', async () => {
      Dashboards.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        dashboardService.getDashboard('nonexistent')
      ).rejects.toThrow(
        expect.objectContaining({
          status: 404,
          message: ERROR_CODES.DASHBOARD_NOT_FOUND,
        })
      );
    });
  });

  describe('createDashboard', () => {
    const createData = {
      name: 'New Dashboard',
      description: 'A new dashboard',
      integrationId: VALID_INTEGRATION_ID,
      providerDashboardId: 99,
      lockedParams: { filter: 'value' },
    };

    it('should create dashboard with correct data', async () => {
      // Mock integration exists
      Integrations.findOne.mockResolvedValue({
        _id: VALID_INTEGRATION_ID,
        name: 'Metabase',
      });

      // Mock finding last dashboard for order
      Dashboards.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({ order: 2 }),
          }),
        }),
      });

      // Mock dashboard creation
      const createdDashboard = {
        _id: VALID_DASHBOARD_ID,
        ...createData,
      };
      Dashboards.create.mockResolvedValue(createdDashboard);

      // Mock getDashboard call after creation
      Dashboards.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: { toString: () => VALID_DASHBOARD_ID },
            name: 'New Dashboard',
            description: 'A new dashboard',
            providerDashboardId: 99,
            order: 3,
            isActive: true,
            lockedParams: { filter: 'value' },
            _company: { toString: () => VALID_GROUP_ID },
            _integration: {
              _id: { toString: () => VALID_INTEGRATION_ID },
              name: 'Metabase',
              provider: 'metabase',
              apiHost: 'https://metabase.example.com',
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        }),
      });

      const result = await dashboardService.createDashboard(VALID_GROUP_ID, createData);

      expect(Dashboards.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Dashboard',
          description: 'A new dashboard',
          providerDashboardId: 99,
          order: 3,
          isActive: true,
        })
      );
      expect(result).toHaveProperty('id');
      expect(result.name).toBe('New Dashboard');
    });

    it('should throw 400 when integration not found', async () => {
      Integrations.findOne.mockResolvedValue(null);

      await expect(
        dashboardService.createDashboard(VALID_GROUP_ID, createData)
      ).rejects.toThrow(
        expect.objectContaining({
          status: 400,
          message: ERROR_CODES.INVALID_INTEGRATION,
        })
      );
    });

    it('should set order to 0 when no existing dashboards', async () => {
      Integrations.findOne.mockResolvedValue({ _id: VALID_INTEGRATION_ID });

      Dashboards.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(null),
          }),
        }),
      });

      Dashboards.create.mockResolvedValue({ _id: VALID_DASHBOARD_ID });

      Dashboards.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: { toString: () => VALID_DASHBOARD_ID },
            name: 'New Dashboard',
            order: 0,
            _company: { toString: () => VALID_GROUP_ID },
            _integration: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        }),
      });

      await dashboardService.createDashboard(VALID_GROUP_ID, createData);

      expect(Dashboards.create).toHaveBeenCalledWith(
        expect.objectContaining({ order: 0 })
      );
    });

    it('should throw 409 on duplicate key error', async () => {
      Integrations.findOne.mockResolvedValue({ _id: VALID_INTEGRATION_ID });

      Dashboards.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(null),
          }),
        }),
      });

      const duplicateError = new Error('Duplicate key');
      duplicateError.code = 11000;
      Dashboards.create.mockRejectedValue(duplicateError);

      await expect(
        dashboardService.createDashboard(VALID_GROUP_ID, createData)
      ).rejects.toThrow(
        expect.objectContaining({
          status: 409,
          message: ERROR_CODES.DASHBOARD_ALREADY_EXISTS,
        })
      );
    });
  });

  describe('updateDashboard', () => {
    it('should update dashboard fields', async () => {
      const mockDashboard = {
        _id: VALID_DASHBOARD_ID,
        name: 'Old Name',
        description: 'Old desc',
        _company: VALID_GROUP_ID,
        _integration: { toString: () => VALID_INTEGRATION_ID },
        save: jest.fn().mockResolvedValue(true),
      };

      Dashboards.findById.mockResolvedValueOnce(mockDashboard);

      // Mock getDashboard after update
      Dashboards.findById.mockReturnValueOnce({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: { toString: () => VALID_DASHBOARD_ID },
            name: 'New Name',
            description: 'New desc',
            _company: { toString: () => VALID_GROUP_ID },
            _integration: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        }),
      });

      await dashboardService.updateDashboard(VALID_DASHBOARD_ID, {
        name: 'New Name',
        description: 'New desc',
      });

      expect(mockDashboard.name).toBe('New Name');
      expect(mockDashboard.description).toBe('New desc');
      expect(mockDashboard.save).toHaveBeenCalled();
    });

    it('should throw 404 when dashboard not found', async () => {
      Dashboards.findById.mockResolvedValue(null);

      await expect(
        dashboardService.updateDashboard('nonexistent', { name: 'Test' })
      ).rejects.toThrow(
        expect.objectContaining({
          status: 404,
          message: ERROR_CODES.DASHBOARD_NOT_FOUND,
        })
      );
    });

    it('should validate new integration belongs to same group', async () => {
      const mockDashboard = {
        _id: VALID_DASHBOARD_ID,
        _company: VALID_GROUP_ID,
        _integration: { toString: () => 'old-integration' },
        save: jest.fn(),
      };

      Dashboards.findById.mockResolvedValue(mockDashboard);
      Integrations.findOne.mockResolvedValue(null);

      await expect(
        dashboardService.updateDashboard(VALID_DASHBOARD_ID, {
          integrationId: 'new-integration',
        })
      ).rejects.toThrow(
        expect.objectContaining({
          status: 400,
        })
      );
    });
  });

  describe('deleteDashboard', () => {
    it('should delete dashboard by ID', async () => {
      const mockDashboard = {
        _id: VALID_DASHBOARD_ID,
      };

      Dashboards.findById.mockResolvedValue(mockDashboard);
      Dashboards.deleteOne.mockResolvedValue({ deletedCount: 1 });

      await dashboardService.deleteDashboard(VALID_DASHBOARD_ID);

      expect(Dashboards.deleteOne).toHaveBeenCalledWith({
        _id: mockDashboard._id,
      });
    });

    it('should throw 404 when dashboard not found', async () => {
      Dashboards.findById.mockResolvedValue(null);

      await expect(
        dashboardService.deleteDashboard('nonexistent')
      ).rejects.toThrow(
        expect.objectContaining({
          status: 404,
          message: ERROR_CODES.DASHBOARD_NOT_FOUND,
        })
      );
    });
  });

  describe('reorderDashboards', () => {
    it('should update order for all dashboards', async () => {
      const dashboardIds = ['dash1', 'dash2', 'dash3'];

      Dashboards.find.mockResolvedValue([
        { _id: 'dash1' },
        { _id: 'dash2' },
        { _id: 'dash3' },
      ]);

      Dashboards.bulkWrite.mockResolvedValue({});

      // Mock listDashboards return
      Dashboards.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      await dashboardService.reorderDashboards(VALID_GROUP_ID, dashboardIds);

      expect(Dashboards.bulkWrite).toHaveBeenCalledWith([
        { updateOne: { filter: expect.anything(), update: { $set: { order: 0 } } } },
        { updateOne: { filter: expect.anything(), update: { $set: { order: 1 } } } },
        { updateOne: { filter: expect.anything(), update: { $set: { order: 2 } } } },
      ]);
    });

    it('should throw 400 when dashboard count mismatch', async () => {
      const dashboardIds = ['dash1', 'dash2'];

      Dashboards.find.mockResolvedValue([{ _id: 'dash1' }]);

      await expect(
        dashboardService.reorderDashboards(VALID_GROUP_ID, dashboardIds)
      ).rejects.toThrow(
        expect.objectContaining({
          status: 400,
          message: ERROR_CODES.INVALID_REQUEST,
        })
      );
    });
  });

  describe('getGroupIdForDashboard', () => {
    it('should return group ID for dashboard', async () => {
      Dashboards.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _company: { toString: () => VALID_GROUP_ID },
          }),
        }),
      });

      const result = await dashboardService.getGroupIdForDashboard(VALID_DASHBOARD_ID);

      expect(result).toBe(VALID_GROUP_ID);
    });

    it('should return null when dashboard not found', async () => {
      Dashboards.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      const result = await dashboardService.getGroupIdForDashboard('nonexistent');

      expect(result).toBeNull();
    });
  });
});
