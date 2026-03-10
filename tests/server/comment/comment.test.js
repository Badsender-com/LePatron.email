'use strict';

const mongoose = require('mongoose');

// Mock models before requiring the service
jest.mock('../../../packages/server/common/models.common.js');

const { Comments, Mailings, Users } = require('../../../packages/server/common/models.common.js');
const commentService = require('../../../packages/server/comment/comment.service.js');
const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');
const { COMMENT_CATEGORIES, COMMENT_SEVERITIES } = require('../../../packages/server/comment/comment.schema.js');

describe('Comment Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to create mock ObjectId
  const mockObjectId = () => new mongoose.Types.ObjectId();

  // Helper to mock mailing access verification
  const mockMailingAccess = (mailingId, groupId, mailingData = {}) => {
    const mockMailing = {
      _id: mailingId,
      _wireframe: { _company: groupId },
      data: { mainBlocks: { blocks: [] } },
      ...mailingData,
    };
    Mailings.findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockMailing),
    });
    return mockMailing;
  };

  // Helper to mock mailing not found
  const mockMailingNotFound = () => {
    Mailings.findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(null),
    });
  };

  // Helper to create a test user with company access
  const createTestUser = (userId, groupId) => ({
    _id: userId,
    name: 'Test User',
    _company: groupId,
  });

  describe('createComment', () => {
    it('should create a comment on a mailing', async () => {
      const mailingId = mockObjectId();
      const userId = mockObjectId();
      const groupId = mockObjectId();
      const commentId = mockObjectId();

      mockMailingAccess(mailingId, groupId);

      const mockCreatedComment = { _id: commentId };
      Comments.create = jest.fn().mockResolvedValue(mockCreatedComment);
      Comments.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({
          _id: commentId,
          text: 'Test comment',
          _author: { _id: userId, name: 'Test User', email: 'test@example.com' },
        }),
      });

      const result = await commentService.createComment({
        mailingId: mailingId.toString(),
        user: createTestUser(userId, groupId),
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
      const groupId = mockObjectId();

      mockMailingNotFound();

      await expect(
        commentService.createComment({
          mailingId: mailingId.toString(),
          user: createTestUser(userId, groupId),
          text: 'Test comment',
        })
      ).rejects.toThrow(ERROR_CODES.MAILING_NOT_FOUND);
    });

    it('should throw Forbidden if user has no access to mailing', async () => {
      const mailingId = mockObjectId();
      const userId = mockObjectId();
      const userGroupId = mockObjectId();
      const mailingGroupId = mockObjectId(); // Different group

      mockMailingAccess(mailingId, mailingGroupId);

      await expect(
        commentService.createComment({
          mailingId: mailingId.toString(),
          user: createTestUser(userId, userGroupId),
          text: 'Test comment',
        })
      ).rejects.toThrow(ERROR_CODES.COMMENT_MAILING_ACCESS_DENIED);
    });

    it('should create a comment with block snapshot', async () => {
      const mailingId = mockObjectId();
      const userId = mockObjectId();
      const groupId = mockObjectId();
      const commentId = mockObjectId();

      mockMailingAccess(mailingId, groupId, {
        data: {
          mainBlocks: {
            blocks: [
              { id: 'block_0', type: 'header' },
              { id: 'block_1', type: 'content' },
            ],
          },
        },
      });

      Comments.create = jest.fn().mockResolvedValue({ _id: commentId });
      Comments.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({ _id: commentId }),
      });

      await commentService.createComment({
        mailingId: mailingId.toString(),
        user: createTestUser(userId, groupId),
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

      mockMailingAccess(mailingId, groupId);
      Comments.findById = jest.fn().mockResolvedValue(null);

      await expect(
        commentService.createComment({
          mailingId: mailingId.toString(),
          user: createTestUser(userId, groupId),
          text: 'Reply comment',
          parentCommentId: parentCommentId.toString(),
        })
      ).rejects.toThrow(ERROR_CODES.COMMENT_INVALID_PARENT);
    });

    it('should create comment with mentions', async () => {
      const mailingId = mockObjectId();
      const userId = mockObjectId();
      const mentionedUserId = mockObjectId();
      const groupId = mockObjectId();
      const commentId = mockObjectId();

      mockMailingAccess(mailingId, groupId);
      Users.find = jest.fn().mockResolvedValue([{ _id: mentionedUserId }]);
      Comments.create = jest.fn().mockResolvedValue({ _id: commentId });
      Comments.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({ _id: commentId, mentions: [mentionedUserId] }),
      });

      await commentService.createComment({
        mailingId: mailingId.toString(),
        user: createTestUser(userId, groupId),
        text: 'Mentioning @someone',
        mentions: [mentionedUserId.toString()],
      });

      expect(Comments.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mentions: [mentionedUserId.toString()],
        })
      );
    });

    it('should create reply to parent comment', async () => {
      const mailingId = mockObjectId();
      const userId = mockObjectId();
      const parentAuthorId = mockObjectId();
      const groupId = mockObjectId();
      const parentCommentId = mockObjectId();
      const commentId = mockObjectId();

      mockMailingAccess(mailingId, groupId);

      const mockParentComment = {
        _id: parentCommentId,
        _mailing: mailingId,
        _author: parentAuthorId,
        isDeleted: false,
      };

      Comments.findById = jest.fn().mockResolvedValueOnce(mockParentComment);
      Comments.create = jest.fn().mockResolvedValue({ _id: commentId });
      // Mock the re-fetch after create
      Comments.findById.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({ _id: commentId, _parentComment: parentCommentId }),
      });

      await commentService.createComment({
        mailingId: mailingId.toString(),
        user: createTestUser(userId, groupId),
        text: 'Reply to parent',
        parentCommentId: parentCommentId.toString(),
      });

      expect(Comments.create).toHaveBeenCalledWith(
        expect.objectContaining({
          _parentComment: parentCommentId.toString(),
        })
      );
    });
  });

  describe('findByMailing', () => {
    it('should return all comments for a mailing', async () => {
      const mailingId = mockObjectId();
      const userId = mockObjectId();
      const groupId = mockObjectId();

      mockMailingAccess(mailingId, groupId);

      const mockComments = [
        { _id: mockObjectId(), text: 'Comment 1' },
        { _id: mockObjectId(), text: 'Comment 2' },
      ];

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockComments),
      };
      Comments.find = jest.fn().mockReturnValue(mockQuery);

      const result = await commentService.findByMailing({
        mailingId: mailingId.toString(),
        user: createTestUser(userId, groupId),
      });

      expect(Comments.find).toHaveBeenCalledWith({
        _mailing: mailingId.toString(),
        isDeleted: false,
      });
      expect(result).toHaveLength(2);
    });

    it('should throw Forbidden if user has no access to mailing', async () => {
      const mailingId = mockObjectId();
      const userId = mockObjectId();
      const userGroupId = mockObjectId();
      const mailingGroupId = mockObjectId(); // Different group

      mockMailingAccess(mailingId, mailingGroupId);

      await expect(
        commentService.findByMailing({
          mailingId: mailingId.toString(),
          user: createTestUser(userId, userGroupId),
        })
      ).rejects.toThrow(ERROR_CODES.COMMENT_MAILING_ACCESS_DENIED);
    });

    it('should filter by blockId', async () => {
      const mailingId = mockObjectId();
      const userId = mockObjectId();
      const groupId = mockObjectId();

      mockMailingAccess(mailingId, groupId);

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };
      Comments.find = jest.fn().mockReturnValue(mockQuery);

      await commentService.findByMailing({
        mailingId: mailingId.toString(),
        user: createTestUser(userId, groupId),
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
      const userId = mockObjectId();
      const groupId = mockObjectId();

      mockMailingAccess(mailingId, groupId);

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };
      Comments.find = jest.fn().mockReturnValue(mockQuery);

      await commentService.findByMailing({
        mailingId: mailingId.toString(),
        user: createTestUser(userId, groupId),
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
      const userId = mockObjectId();
      const groupId = mockObjectId();

      mockMailingAccess(mailingId, groupId);

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };
      Comments.find = jest.fn().mockReturnValue(mockQuery);

      await commentService.findByMailing({
        mailingId: mailingId.toString(),
        user: createTestUser(userId, groupId),
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
        lean: jest.fn().mockResolvedValue(mockComment),
      };

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
        lean: jest.fn().mockResolvedValue(mockComment),
      };

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
        lean: jest.fn().mockResolvedValue(mockUpdatedComment),
      };

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
        _author: userId,
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
        lean: jest.fn().mockResolvedValue(mockResolvedComment),
      };

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

  });

  describe('getBlockCommentCounts', () => {
    it('should return counts per block with severity', async () => {
      const mailingId = mockObjectId();
      const userId = mockObjectId();
      const groupId = mockObjectId();

      mockMailingAccess(mailingId, groupId);

      const mockAggregationResult = [
        { _id: 'block_0', count: 2, hasBlocking: false, hasImportant: false },
        { _id: 'block_1', count: 1, hasBlocking: true, hasImportant: false },
      ];

      Comments.getBlockCommentCounts = jest.fn().mockResolvedValue(mockAggregationResult);

      const result = await commentService.getBlockCommentCounts(
        mailingId.toString(),
        createTestUser(userId, groupId)
      );

      expect(result).toEqual({
        block_0: { count: 2, maxSeverity: 'info' },
        block_1: { count: 1, maxSeverity: 'blocking' },
      });
    });

    it('should return empty object if no comments', async () => {
      const mailingId = mockObjectId();
      const userId = mockObjectId();
      const groupId = mockObjectId();

      mockMailingAccess(mailingId, groupId);
      Comments.getBlockCommentCounts = jest.fn().mockResolvedValue([]);

      const result = await commentService.getBlockCommentCounts(
        mailingId.toString(),
        createTestUser(userId, groupId)
      );

      expect(result).toEqual({});
    });

    it('should throw Forbidden if user has no access', async () => {
      const mailingId = mockObjectId();
      const userId = mockObjectId();
      const userGroupId = mockObjectId();
      const mailingGroupId = mockObjectId();

      mockMailingAccess(mailingId, mailingGroupId);

      await expect(
        commentService.getBlockCommentCounts(
          mailingId.toString(),
          createTestUser(userId, userGroupId)
        )
      ).rejects.toThrow(ERROR_CODES.COMMENT_MAILING_ACCESS_DENIED);
    });
  });

  describe('getUnresolvedCountByMailing', () => {
    it('should return unresolved count', async () => {
      const mailingId = mockObjectId();
      const userId = mockObjectId();
      const groupId = mockObjectId();

      mockMailingAccess(mailingId, groupId);
      Comments.countUnresolvedByMailing = jest.fn().mockResolvedValue(5);

      const result = await commentService.getUnresolvedCountByMailing(
        mailingId.toString(),
        createTestUser(userId, groupId)
      );

      expect(result).toBe(5);
    });

    it('should throw Forbidden if user has no access', async () => {
      const mailingId = mockObjectId();
      const userId = mockObjectId();
      const userGroupId = mockObjectId();
      const mailingGroupId = mockObjectId();

      mockMailingAccess(mailingId, mailingGroupId);

      await expect(
        commentService.getUnresolvedCountByMailing(
          mailingId.toString(),
          createTestUser(userId, userGroupId)
        )
      ).rejects.toThrow(ERROR_CODES.COMMENT_MAILING_ACCESS_DENIED);
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
