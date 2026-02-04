'use strict';

const mongoose = require('mongoose');

// Mock models before requiring the service
jest.mock('../common/models.common.js');
jest.mock('../notification/notification.service.js');

const { Comments, Mailings, Users } = require('../common/models.common.js');
const notificationService = require('../notification/notification.service.js');
const commentService = require('./comment.service.js');
const ERROR_CODES = require('../constant/error-codes.js');
const { COMMENT_CATEGORIES, COMMENT_SEVERITIES } = require('./comment.schema.js');

describe('Comment Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to create mock ObjectId
  const mockObjectId = () => new mongoose.Types.ObjectId();

  describe('createComment', () => {
    it('should create a comment on a mailing', async () => {
      const mailingId = mockObjectId();
      const userId = mockObjectId();
      const groupId = mockObjectId();
      const commentId = mockObjectId();

      const mockMailing = {
        _id: mailingId,
        _company: groupId,
        name: 'Test Mailing',
        data: { mainBlocks: { blocks: [] } },
      };

      const mockComment = {
        _id: commentId,
        _mailing: mailingId,
        _company: groupId,
        text: 'Test comment',
        category: 'general',
        severity: 'info',
        _author: userId,
        authorName: 'Test User',
        populate: jest.fn().mockResolvedValue({
          _id: commentId,
          text: 'Test comment',
          _author: { _id: userId, name: 'Test User', email: 'test@example.com' },
        }),
      };

      Mailings.findById = jest.fn().mockResolvedValue(mockMailing);
      Comments.create = jest.fn().mockResolvedValue(mockComment);

      const result = await commentService.createComment({
        mailingId: mailingId.toString(),
        user: { _id: userId, name: 'Test User', _company: groupId },
        text: 'Test comment',
        category: 'general',
        severity: 'info',
      });

      expect(Mailings.findById).toHaveBeenCalledWith(mailingId.toString());
      expect(Comments.create).toHaveBeenCalledWith(
        expect.objectContaining({
          _mailing: mailingId.toString(),
          text: 'Test comment',
          category: 'general',
          severity: 'info',
        })
      );
      expect(result._author.name).toBe('Test User');
    });

    it('should throw NotFound if mailing does not exist', async () => {
      const mailingId = mockObjectId();
      const userId = mockObjectId();

      Mailings.findById = jest.fn().mockResolvedValue(null);

      await expect(
        commentService.createComment({
          mailingId: mailingId.toString(),
          user: { _id: userId, name: 'Test User' },
          text: 'Test comment',
        })
      ).rejects.toThrow(ERROR_CODES.MAILING_NOT_FOUND);
    });

    it('should create a comment with block snapshot', async () => {
      const mailingId = mockObjectId();
      const userId = mockObjectId();
      const groupId = mockObjectId();
      const commentId = mockObjectId();

      const mockMailing = {
        _id: mailingId,
        _company: groupId,
        data: {
          mainBlocks: {
            blocks: [
              { id: 'block_0', type: 'header' },
              { id: 'block_1', type: 'content' },
            ],
          },
        },
      };

      const mockComment = {
        _id: commentId,
        blockId: 'block_1',
        blockSnapshot: { index: 1, type: 'content' },
        populate: jest.fn().mockResolvedValue({ _id: commentId }),
      };

      Mailings.findById = jest.fn().mockResolvedValue(mockMailing);
      Comments.create = jest.fn().mockResolvedValue(mockComment);

      await commentService.createComment({
        mailingId: mailingId.toString(),
        user: { _id: userId, name: 'Test User', _company: groupId },
        blockId: 'block_1',
        text: 'Comment on block',
      });

      expect(Comments.create).toHaveBeenCalledWith(
        expect.objectContaining({
          blockId: 'block_1',
          blockSnapshot: expect.objectContaining({
            index: 1,
            type: 'content',
          }),
        })
      );
    });

    it('should throw BadRequest for invalid parent comment', async () => {
      const mailingId = mockObjectId();
      const userId = mockObjectId();
      const groupId = mockObjectId();
      const parentCommentId = mockObjectId();

      const mockMailing = {
        _id: mailingId,
        _company: groupId,
        data: {},
      };

      Mailings.findById = jest.fn().mockResolvedValue(mockMailing);
      Comments.findById = jest.fn().mockResolvedValue(null);

      await expect(
        commentService.createComment({
          mailingId: mailingId.toString(),
          user: { _id: userId, name: 'Test User', _company: groupId },
          text: 'Reply comment',
          parentCommentId: parentCommentId.toString(),
        })
      ).rejects.toThrow(ERROR_CODES.COMMENT_INVALID_PARENT);
    });

    it('should create mention notifications', async () => {
      const mailingId = mockObjectId();
      const userId = mockObjectId();
      const mentionedUserId = mockObjectId();
      const groupId = mockObjectId();
      const commentId = mockObjectId();

      const mockMailing = {
        _id: mailingId,
        _company: groupId,
        data: {},
      };

      const mockComment = {
        _id: commentId,
        mentions: [mentionedUserId],
        populate: jest.fn().mockResolvedValue({ _id: commentId }),
      };

      Mailings.findById = jest.fn().mockResolvedValue(mockMailing);
      Users.find = jest.fn().mockResolvedValue([{ _id: mentionedUserId }]);
      Comments.create = jest.fn().mockResolvedValue(mockComment);
      notificationService.createMentionNotifications = jest.fn().mockResolvedValue([]);

      await commentService.createComment({
        mailingId: mailingId.toString(),
        user: { _id: userId, name: 'Test User', _company: groupId },
        text: 'Mentioning @someone',
        mentions: [mentionedUserId.toString()],
      });

      expect(notificationService.createMentionNotifications).toHaveBeenCalledTimes(1);
    });

    it('should create reply notification for parent author', async () => {
      const mailingId = mockObjectId();
      const userId = mockObjectId();
      const parentAuthorId = mockObjectId();
      const groupId = mockObjectId();
      const parentCommentId = mockObjectId();
      const commentId = mockObjectId();

      const mockMailing = {
        _id: mailingId,
        _company: groupId,
        data: {},
      };

      const mockParentComment = {
        _id: parentCommentId,
        _mailing: mailingId,
        _author: parentAuthorId,
        isDeleted: false,
      };

      const mockComment = {
        _id: commentId,
        _parentComment: parentCommentId,
        populate: jest.fn().mockResolvedValue({ _id: commentId }),
      };

      Mailings.findById = jest.fn().mockResolvedValue(mockMailing);
      Comments.findById = jest.fn()
        .mockResolvedValueOnce(mockParentComment) // First call for validation
        .mockResolvedValueOnce(mockParentComment); // Second call for notification
      Comments.create = jest.fn().mockResolvedValue(mockComment);
      notificationService.createReplyNotification = jest.fn().mockResolvedValue({});

      await commentService.createComment({
        mailingId: mailingId.toString(),
        user: { _id: userId, name: 'Test User', _company: groupId },
        text: 'Reply to parent',
        parentCommentId: parentCommentId.toString(),
      });

      expect(notificationService.createReplyNotification).toHaveBeenCalledTimes(1);
    });
  });

  describe('findByMailing', () => {
    it('should return all comments for a mailing', async () => {
      const mailingId = mockObjectId();

      const mockComments = [
        { _id: mockObjectId(), text: 'Comment 1' },
        { _id: mockObjectId(), text: 'Comment 2' },
      ];

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockComments),
      };
      Comments.find = jest.fn().mockReturnValue(mockQuery);

      const result = await commentService.findByMailing({
        mailingId: mailingId.toString(),
      });

      expect(Comments.find).toHaveBeenCalledWith({
        _mailing: mailingId.toString(),
        isDeleted: false,
      });
      expect(result).toHaveLength(2);
    });

    it('should filter by blockId', async () => {
      const mailingId = mockObjectId();

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([]),
      };
      Comments.find = jest.fn().mockReturnValue(mockQuery);

      await commentService.findByMailing({
        mailingId: mailingId.toString(),
        blockId: 'block_0',
      });

      expect(Comments.find).toHaveBeenCalledWith({
        _mailing: mailingId.toString(),
        isDeleted: false,
        blockId: 'block_0',
      });
    });

    it('should filter by resolved status', async () => {
      const mailingId = mockObjectId();

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([]),
      };
      Comments.find = jest.fn().mockReturnValue(mockQuery);

      await commentService.findByMailing({
        mailingId: mailingId.toString(),
        resolved: false,
      });

      expect(Comments.find).toHaveBeenCalledWith({
        _mailing: mailingId.toString(),
        isDeleted: false,
        resolved: false,
      });
    });

    it('should exclude replies when includeReplies is false', async () => {
      const mailingId = mockObjectId();

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([]),
      };
      Comments.find = jest.fn().mockReturnValue(mockQuery);

      await commentService.findByMailing({
        mailingId: mailingId.toString(),
        includeReplies: false,
      });

      expect(Comments.find).toHaveBeenCalledWith({
        _mailing: mailingId.toString(),
        isDeleted: false,
        _parentComment: null,
      });
    });
  });

  describe('findById', () => {
    it('should return comment by ID', async () => {
      const commentId = mockObjectId();

      const mockComment = {
        _id: commentId,
        text: 'Test comment',
        isDeleted: false,
      };

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
      };
      mockQuery.populate.mockReturnValueOnce(mockQuery);
      mockQuery.populate.mockReturnValueOnce(mockQuery);
      mockQuery.populate.mockResolvedValueOnce(mockComment);

      Comments.findById = jest.fn().mockReturnValue(mockQuery);

      const result = await commentService.findById(commentId.toString());

      expect(result.text).toBe('Test comment');
    });

    it('should throw NotFound for deleted comment', async () => {
      const commentId = mockObjectId();

      const mockComment = {
        _id: commentId,
        isDeleted: true,
      };

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
      };
      mockQuery.populate.mockReturnValueOnce(mockQuery);
      mockQuery.populate.mockReturnValueOnce(mockQuery);
      mockQuery.populate.mockResolvedValueOnce(mockComment);

      Comments.findById = jest.fn().mockReturnValue(mockQuery);

      await expect(
        commentService.findById(commentId.toString())
      ).rejects.toThrow(ERROR_CODES.COMMENT_NOT_FOUND);
    });
  });

  describe('updateComment', () => {
    it('should update comment text', async () => {
      const commentId = mockObjectId();
      const userId = mockObjectId();

      const mockComment = {
        _id: commentId,
        _author: userId,
        text: 'Original text',
        isDeleted: false,
      };

      const mockUpdatedComment = {
        _id: commentId,
        text: 'Updated text',
      };

      Comments.findById = jest.fn().mockResolvedValue(mockComment);

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
      };
      mockQuery.populate.mockReturnValueOnce(mockQuery);
      mockQuery.populate.mockReturnValueOnce(mockQuery);
      mockQuery.populate.mockResolvedValueOnce(mockUpdatedComment);

      Comments.findByIdAndUpdate = jest.fn().mockReturnValue(mockQuery);

      const result = await commentService.updateComment({
        commentId: commentId.toString(),
        user: { _id: userId },
        updates: { text: 'Updated text' },
      });

      expect(result.text).toBe('Updated text');
    });

    it('should throw Forbidden if not author', async () => {
      const commentId = mockObjectId();
      const authorId = mockObjectId();
      const otherUserId = mockObjectId();

      const mockComment = {
        _id: commentId,
        _author: authorId,
        isDeleted: false,
      };

      Comments.findById = jest.fn().mockResolvedValue(mockComment);

      await expect(
        commentService.updateComment({
          commentId: commentId.toString(),
          user: { _id: otherUserId },
          updates: { text: 'Updated text' },
        })
      ).rejects.toThrow(ERROR_CODES.COMMENT_ACCESS_DENIED);
    });
  });

  describe('deleteComment', () => {
    it('should soft delete a comment as author', async () => {
      const commentId = mockObjectId();
      const userId = mockObjectId();

      const mockComment = {
        _id: commentId,
        _author: userId,
        isDeleted: false,
      };

      Comments.findById = jest.fn().mockResolvedValue(mockComment);
      Comments.deleteWithReplies = jest.fn().mockResolvedValue({});

      const result = await commentService.deleteComment({
        commentId: commentId.toString(),
        user: { _id: userId },
      });

      expect(result.success).toBe(true);
      expect(Comments.deleteWithReplies).toHaveBeenCalledWith(commentId.toString());
    });

    it('should allow group admin to delete any comment', async () => {
      const commentId = mockObjectId();
      const authorId = mockObjectId();
      const adminId = mockObjectId();

      const mockComment = {
        _id: commentId,
        _author: authorId,
        isDeleted: false,
      };

      Comments.findById = jest.fn().mockResolvedValue(mockComment);
      Comments.deleteWithReplies = jest.fn().mockResolvedValue({});

      const result = await commentService.deleteComment({
        commentId: commentId.toString(),
        user: { _id: adminId, role: 'company_admin' },
      });

      expect(result.success).toBe(true);
    });

    it('should throw Forbidden if not author or admin', async () => {
      const commentId = mockObjectId();
      const authorId = mockObjectId();
      const otherUserId = mockObjectId();

      const mockComment = {
        _id: commentId,
        _author: authorId,
        isDeleted: false,
      };

      Comments.findById = jest.fn().mockResolvedValue(mockComment);

      await expect(
        commentService.deleteComment({
          commentId: commentId.toString(),
          user: { _id: otherUserId, role: 'regular_user' },
        })
      ).rejects.toThrow(ERROR_CODES.COMMENT_ACCESS_DENIED);
    });
  });

  describe('resolveComment', () => {
    it('should mark comment as resolved', async () => {
      const commentId = mockObjectId();
      const userId = mockObjectId();
      const mailingId = mockObjectId();

      const mockComment = {
        _id: commentId,
        _mailing: mailingId,
        _author: userId, // Same user resolving their own comment
        resolved: false,
        isDeleted: false,
      };

      const mockResolvedComment = {
        _id: commentId,
        resolved: true,
        _resolvedBy: userId,
        resolvedAt: new Date(),
      };

      Comments.findById = jest.fn().mockResolvedValue(mockComment);

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
      };
      mockQuery.populate.mockReturnValueOnce(mockQuery);
      mockQuery.populate.mockResolvedValueOnce(mockResolvedComment);

      Comments.findByIdAndUpdate = jest.fn().mockReturnValue(mockQuery);

      const result = await commentService.resolveComment({
        commentId: commentId.toString(),
        user: { _id: userId, name: 'Test User' },
      });

      expect(result.resolved).toBe(true);
    });

    it('should throw BadRequest if already resolved', async () => {
      const commentId = mockObjectId();
      const userId = mockObjectId();

      const mockComment = {
        _id: commentId,
        resolved: true,
        isDeleted: false,
      };

      Comments.findById = jest.fn().mockResolvedValue(mockComment);

      await expect(
        commentService.resolveComment({
          commentId: commentId.toString(),
          user: { _id: userId, name: 'Test User' },
        })
      ).rejects.toThrow(ERROR_CODES.COMMENT_ALREADY_RESOLVED);
    });

    it('should create notification when different user resolves', async () => {
      const commentId = mockObjectId();
      const authorId = mockObjectId();
      const resolverId = mockObjectId();
      const mailingId = mockObjectId();

      const mockComment = {
        _id: commentId,
        _mailing: mailingId,
        _author: authorId,
        resolved: false,
        isDeleted: false,
      };

      const mockMailing = { _id: mailingId, name: 'Test Mailing' };

      const mockResolvedComment = {
        _id: commentId,
        _author: authorId,
        resolved: true,
      };

      Comments.findById = jest.fn().mockResolvedValue(mockComment);
      Mailings.findById = jest.fn().mockResolvedValue(mockMailing);

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
      };
      mockQuery.populate.mockReturnValueOnce(mockQuery);
      mockQuery.populate.mockResolvedValueOnce(mockResolvedComment);

      Comments.findByIdAndUpdate = jest.fn().mockReturnValue(mockQuery);
      notificationService.createResolvedNotification = jest.fn().mockResolvedValue({});

      await commentService.resolveComment({
        commentId: commentId.toString(),
        user: { _id: resolverId, name: 'Resolver' },
      });

      expect(notificationService.createResolvedNotification).toHaveBeenCalledTimes(1);
    });
  });

  describe('getBlockCommentCounts', () => {
    it('should return counts per block', async () => {
      const mailingId = mockObjectId();

      const mockAggregationResult = [
        { _id: 'block_0', count: 2, hasBlocking: 0 },
        { _id: 'block_1', count: 1, hasBlocking: 1 },
      ];

      Comments.getBlockCommentCounts = jest.fn().mockResolvedValue(mockAggregationResult);

      const result = await commentService.getBlockCommentCounts(mailingId.toString());

      expect(result).toEqual({
        block_0: 2,
        block_1: 1,
      });
    });

    it('should return empty object if no comments', async () => {
      const mailingId = mockObjectId();

      Comments.getBlockCommentCounts = jest.fn().mockResolvedValue([]);

      const result = await commentService.getBlockCommentCounts(mailingId.toString());

      expect(result).toEqual({});
    });
  });

  describe('getUnresolvedCountByMailing', () => {
    it('should return unresolved count', async () => {
      const mailingId = mockObjectId();

      Comments.countUnresolvedByMailing = jest.fn().mockResolvedValue(5);

      const result = await commentService.getUnresolvedCountByMailing(mailingId.toString());

      expect(result).toBe(5);
    });
  });

  describe('COMMENT_CATEGORIES', () => {
    it('should have expected categories', () => {
      expect(COMMENT_CATEGORIES).toEqual({
        DESIGN: 'design',
        CONTENT: 'content',
        GENERAL: 'general',
      });
    });
  });

  describe('COMMENT_SEVERITIES', () => {
    it('should have expected severities', () => {
      expect(COMMENT_SEVERITIES).toEqual({
        INFO: 'info',
        IMPORTANT: 'important',
        BLOCKING: 'blocking',
      });
    });
  });
});
