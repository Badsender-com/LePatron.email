'use strict';

const { Types } = require('mongoose');

// Mock the compiled models and the group filter helper before requiring the
// service, so no real DB / mongoose model is touched.
jest.mock('../../../packages/server/common/models.common.js', () => ({
  FeedMappings: {
    create: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    deleteOne: jest.fn(),
  },
  Integrations: {
    findById: jest.fn(),
  },
  Templates: {
    findById: jest.fn(),
  },
}));

jest.mock('../../../packages/server/utils/model.js', () => ({
  addGroupFilter: jest.fn((user, filter) => {
    if (user.isAdmin) return filter;
    return { ...filter, _company: user.group.id };
  }),
}));

const feedMappingService = require('../../../packages/server/feed-mapping/feed-mapping.service.js');
const {
  FeedMappings,
  Integrations,
  Templates,
} = require('../../../packages/server/common/models.common.js');
const modelsUtils = require('../../../packages/server/utils/model.js');

describe('feed-mapping.service authorization', () => {
  const groupId = new Types.ObjectId().toString();
  const otherGroupId = new Types.ObjectId().toString();
  const integrationId = new Types.ObjectId().toString();
  const templateId = new Types.ObjectId().toString();
  const feedMappingId = new Types.ObjectId().toString();

  const regularUser = { isAdmin: false, group: { id: groupId } };
  const adminUser = { isAdmin: true, group: undefined };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fieldMapping conversion (dot-in-key safety)', () => {
    it('stores each column as an array of pairs, never dot-keyed objects', () => {
      const stored = feedMappingService.toStorageFieldMapping([
        { 'imageOptions.src': 'image', globaltitleText: 'title' },
        {},
      ]);

      expect(stored).toEqual([
        [
          { blockField: 'imageOptions.src', feedProperty: 'image' },
          { blockField: 'globaltitleText', feedProperty: 'title' },
        ],
        [],
      ]);
      // The MongoDB-hostile case: no stored key may contain a dot.
      const anyDotKey = stored
        .flat()
        .some((pair) => Object.keys(pair).some((k) => k.includes('.')));
      expect(anyDotKey).toBe(false);
    });

    it('round-trips storage <-> api shape losslessly', () => {
      const api = [{ 'imageOptions.src': 'image', globaltitleText: 'title' }];
      const back = feedMappingService.toApiFieldMapping(
        feedMappingService.toStorageFieldMapping(api)
      );
      expect(back).toEqual(api);
    });

    it('is idempotent when given already-stored (array) columns', () => {
      const stored = [
        [{ blockField: 'imageOptions.src', feedProperty: 'image' }],
      ];
      expect(feedMappingService.toStorageFieldMapping(stored)).toEqual(stored);
    });
  });

  describe('create', () => {
    it('creates a mapping when integration and template belong to the user group', async () => {
      Integrations.findById.mockResolvedValue({ _company: groupId });
      Templates.findById.mockResolvedValue({ _company: groupId });
      FeedMappings.create.mockResolvedValue({
        _id: feedMappingId,
        fieldMapping: [
          [{ blockField: 'imageOptions.src', feedProperty: 'image' }],
        ],
      });

      const result = await feedMappingService.create({
        user: regularUser,
        integrationId,
        templateId,
        blockName: 'articlesBlock',
        fieldMapping: [{ 'imageOptions.src': 'image' }],
      });

      // Stored in array-of-pairs shape...
      const storedArg = FeedMappings.create.mock.calls[0][0].fieldMapping;
      expect(storedArg).toEqual([
        [{ blockField: 'imageOptions.src', feedProperty: 'image' }],
      ]);
      // ...but returned to the API in object shape.
      expect(result.fieldMapping).toEqual([{ 'imageOptions.src': 'image' }]);
    });

    it('rejects when the integration belongs to another group', async () => {
      Integrations.findById.mockResolvedValue({ _company: otherGroupId });

      await expect(
        feedMappingService.create({
          user: regularUser,
          integrationId,
          templateId,
          blockName: 'articlesBlock',
          fieldMapping: [{ title: 'title' }],
        })
      ).rejects.toThrow();
      expect(FeedMappings.create).not.toHaveBeenCalled();
    });

    it('rejects when the template belongs to another group', async () => {
      Integrations.findById.mockResolvedValue({ _company: groupId });
      Templates.findById.mockResolvedValue({ _company: otherGroupId });

      await expect(
        feedMappingService.create({
          user: regularUser,
          integrationId,
          templateId,
          blockName: 'articlesBlock',
          fieldMapping: [{ title: 'title' }],
        })
      ).rejects.toThrow();
      expect(FeedMappings.create).not.toHaveBeenCalled();
    });

    it('rejects an invalid integration id before any DB lookup', async () => {
      await expect(
        feedMappingService.create({
          user: regularUser,
          integrationId: 'not-an-object-id',
          templateId,
          blockName: 'articlesBlock',
          fieldMapping: [{ title: 'title' }],
        })
      ).rejects.toThrow();
      expect(Integrations.findById).not.toHaveBeenCalled();
    });

    it('lets an admin create across groups (admin is unscoped)', async () => {
      Integrations.findById.mockResolvedValue({ _company: otherGroupId });
      Templates.findById.mockResolvedValue({ _company: otherGroupId });
      FeedMappings.create.mockResolvedValue({ _id: feedMappingId });

      await feedMappingService.create({
        user: adminUser,
        integrationId,
        templateId,
        blockName: 'articlesBlock',
        fieldMapping: [{ title: 'title' }],
      });

      expect(FeedMappings.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('findByIdForUser (via deleteFeedMapping)', () => {
    it('rejects deleting a mapping owned by another group', async () => {
      FeedMappings.findById.mockResolvedValue({
        _id: feedMappingId,
        _company: { toString: () => otherGroupId },
      });

      await expect(
        feedMappingService.deleteFeedMapping({
          user: regularUser,
          feedMappingId,
        })
      ).rejects.toThrow();
      expect(FeedMappings.deleteOne).not.toHaveBeenCalled();
    });

    it('lets a group owner delete its own mapping', async () => {
      FeedMappings.findById.mockResolvedValue({
        _id: feedMappingId,
        _company: { toString: () => groupId },
      });
      FeedMappings.deleteOne.mockResolvedValue({ deletedCount: 1 });

      await feedMappingService.deleteFeedMapping({
        user: regularUser,
        feedMappingId,
      });

      expect(FeedMappings.deleteOne).toHaveBeenCalledTimes(1);
    });

    it('throws NotFound for an invalid feedMappingId', async () => {
      await expect(
        feedMappingService.deleteFeedMapping({
          user: regularUser,
          feedMappingId: 'bad-id',
        })
      ).rejects.toThrow();
      expect(FeedMappings.findById).not.toHaveBeenCalled();
    });
  });

  describe('findActiveByTemplate', () => {
    it('scopes the query to the user group for a regular user', async () => {
      FeedMappings.find.mockResolvedValue([]);

      await feedMappingService.findActiveByTemplate({
        templateId,
        user: regularUser,
      });

      expect(modelsUtils.addGroupFilter).toHaveBeenCalledWith(
        regularUser,
        expect.objectContaining({ isActive: true })
      );
      const passedFilter = FeedMappings.find.mock.calls[0][0];
      expect(passedFilter._company).toBe(groupId);
    });
  });
});
