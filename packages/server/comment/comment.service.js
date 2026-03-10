'use strict';

const { BadRequest, Forbidden, NotFound } = require('http-errors');

const { Comments, Mailings, Users } = require('../common/models.common.js');
const ERROR_CODES = require('../constant/error-codes.js');
const logger = require('../utils/logger.js');

module.exports = {
  createComment,
  findByMailing,
  findById,
  updateComment,
  deleteComment,
  resolveComment,
  unresolveComment,
  getBlockCommentCounts,
  getUnresolvedCountByMailing,
};

/**
 * Extract user's company ID from various formats
 * Handles populated objects, raw ObjectIds, and aliased fields
 */
function getUserCompanyId(user) {
  return (
    user._company?._id ||
    user._company?.id ||
    user._company ||
    user.group?._id ||
    user.group?.id ||
    user.group
  );
}

/**
 * Verify user has access to a mailing
 * @param {string} mailingId - The mailing ID
 * @param {Object} user - The user object
 * @returns {Object} The mailing with _wireframe populated
 * @throws {NotFound} If mailing doesn't exist
 * @throws {Forbidden} If user doesn't have access
 */
async function verifyMailingAccess(mailingId, user) {
  const mailing = await Mailings.findById(mailingId).populate(
    '_wireframe',
    '_company'
  );

  if (!mailing) {
    throw new NotFound(ERROR_CODES.MAILING_NOT_FOUND);
  }

  const userCompanyId = getUserCompanyId(user);
  const mailingCompanyId = mailing._wireframe?._company;

  if (!userCompanyId || !mailingCompanyId) {
    throw new Forbidden(ERROR_CODES.COMMENT_MAILING_ACCESS_DENIED);
  }

  const hasAccess =
    String(userCompanyId) === String(mailingCompanyId);

  if (!hasAccess) {
    throw new Forbidden(ERROR_CODES.COMMENT_MAILING_ACCESS_DENIED);
  }

  return mailing;
}

/**
 * Create a new comment
 */
async function createComment({
  mailingId,
  user,
  blockId,
  text,
  category,
  severity,
  parentCommentId,
  mentions,
}) {
  // Validate mailing exists and user has access
  const mailing = await verifyMailingAccess(mailingId, user);

  // Validate parent comment if provided
  if (parentCommentId) {
    const parentComment = await Comments.findById(parentCommentId);
    if (!parentComment || parentComment.isDeleted) {
      throw new BadRequest(ERROR_CODES.COMMENT_INVALID_PARENT);
    }
    if (parentComment._mailing.toString() !== mailingId) {
      throw new BadRequest(ERROR_CODES.COMMENT_INVALID_PARENT);
    }
  }

  // Validate mentions are in the same group
  const userCompanyId = getUserCompanyId(user);
  if (mentions && mentions.length > 0) {
    const mentionedUsers = await Users.find({
      _id: { $in: mentions },
      _company: userCompanyId,
    });
    if (mentionedUsers.length !== mentions.length) {
      throw new BadRequest(ERROR_CODES.MENTION_USER_NOT_IN_GROUP);
    }
  }

  // Capture block snapshot if blockId provided
  let blockSnapshot = null;
  if (blockId) {
    blockSnapshot = captureBlockSnapshot(mailing, blockId);
  }

  const comment = await Comments.create({
    _mailing: mailingId,
    _company: mailing._wireframe?._company || userCompanyId,
    blockId,
    blockSnapshot,
    text,
    category: category || 'general',
    severity: severity || 'info',
    _author: user._id || user.id,
    authorName: user.name,
    _parentComment: parentCommentId || null,
    mentions: mentions || [],
  });

  logger.log('Comment created', { commentId: comment._id, mailingId });

  // Re-fetch with lean() to avoid User virtuals accessing unpopulated _company
  return Comments.findById(comment._id)
    .populate('_author', 'name email')
    .lean();
}

/**
 * Find comments for a mailing with filters
 */
async function findByMailing({
  mailingId,
  user,
  blockId,
  resolved,
  includeReplies = true,
}) {
  // Verify user has access to this mailing
  await verifyMailingAccess(mailingId, user);

  const query = {
    _mailing: mailingId,
    isDeleted: false,
  };

  if (blockId !== undefined) {
    query.blockId = blockId;
  }

  if (resolved !== undefined) {
    query.resolved = resolved;
  }

  if (!includeReplies) {
    query._parentComment = null;
  }

  const comments = await Comments.find(query)
    .populate('_author', 'name email')
    .populate('_resolvedBy', 'name')
    .populate('mentions', 'name email')
    .sort({ createdAt: 1 })
    .lean(); // Use lean() to avoid User virtuals accessing unpopulated _company

  return comments;
}

/**
 * Find comment by ID
 */
async function findById(commentId) {
  const comment = await Comments.findById(commentId)
    .populate('_author', 'name email')
    .populate('_resolvedBy', 'name')
    .populate('mentions', 'name email')
    .lean(); // Use lean() to avoid User virtuals accessing unpopulated _company

  if (!comment || comment.isDeleted) {
    throw new NotFound(ERROR_CODES.COMMENT_NOT_FOUND);
  }

  return comment;
}

/**
 * Update a comment (text, category, severity)
 */
async function updateComment({ commentId, user, updates }) {
  const comment = await Comments.findById(commentId);

  if (!comment || comment.isDeleted) {
    throw new NotFound(ERROR_CODES.COMMENT_NOT_FOUND);
  }

  // Only author can update their comment
  const userId = user._id || user.id;
  if (comment._author.toString() !== userId.toString()) {
    throw new Forbidden(ERROR_CODES.COMMENT_ACCESS_DENIED);
  }

  const allowedFields = ['text', 'category', 'severity'];
  const updateData = {};

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      updateData[field] = updates[field];
    }
  }

  // Handle mentions update
  if (updates.mentions !== undefined) {
    // Validate new mentions are in the same group
    if (updates.mentions.length > 0) {
      const userCompanyId = getUserCompanyId(user);
      const mentionedUsers = await Users.find({
        _id: { $in: updates.mentions },
        _company: userCompanyId,
      });
      if (mentionedUsers.length !== updates.mentions.length) {
        throw new BadRequest(ERROR_CODES.MENTION_USER_NOT_IN_GROUP);
      }
    }
    updateData.mentions = updates.mentions;
  }

  const updatedComment = await Comments.findByIdAndUpdate(
    commentId,
    { $set: updateData },
    { new: true }
  )
    .populate('_author', 'name email')
    .populate('_resolvedBy', 'name')
    .populate('mentions', 'name email')
    .lean(); // Use lean() to avoid User virtuals accessing unpopulated _company

  logger.log('Comment updated', { commentId });

  return updatedComment;
}

/**
 * Delete a comment (soft delete with cascade)
 */
async function deleteComment({ commentId, user }) {
  const comment = await Comments.findById(commentId);

  if (!comment || comment.isDeleted) {
    throw new NotFound(ERROR_CODES.COMMENT_NOT_FOUND);
  }

  // Check permission: author or group admin
  const userId = user._id || user.id;
  const isAuthor = comment._author.toString() === userId.toString();
  const isGroupAdmin = user.role === 'company_admin' || user.role === 'super_admin';

  if (!isAuthor && !isGroupAdmin) {
    throw new Forbidden(ERROR_CODES.COMMENT_ACCESS_DENIED);
  }

  // Cascade delete: delete comment and all its replies
  await Comments.deleteWithReplies(commentId);

  logger.log('Comment deleted (cascade)', { commentId, deletedBy: userId });

  return { success: true, deletedId: commentId };
}

/**
 * Mark a comment as resolved
 */
async function resolveComment({ commentId, user }) {
  const comment = await Comments.findById(commentId);

  if (!comment || comment.isDeleted) {
    throw new NotFound(ERROR_CODES.COMMENT_NOT_FOUND);
  }

  if (comment.resolved) {
    throw new BadRequest(ERROR_CODES.COMMENT_ALREADY_RESOLVED);
  }

  const updatedComment = await Comments.findByIdAndUpdate(
    commentId,
    {
      $set: {
        resolved: true,
        _resolvedBy: user._id || user.id,
        resolvedAt: new Date(),
      },
    },
    { new: true }
  )
    .populate('_author', 'name email')
    .populate('_resolvedBy', 'name')
    .lean(); // Use lean() to avoid User virtuals accessing unpopulated _company

  logger.log('Comment resolved', { commentId, resolvedBy: user._id || user.id });

  return updatedComment;
}

/**
 * Mark a comment as unresolved (reopen)
 */
async function unresolveComment({ commentId, user }) {
  const comment = await Comments.findById(commentId);

  if (!comment || comment.isDeleted) {
    throw new NotFound(ERROR_CODES.COMMENT_NOT_FOUND);
  }

  if (!comment.resolved) {
    throw new BadRequest(ERROR_CODES.COMMENT_NOT_RESOLVED);
  }

  const updatedComment = await Comments.findByIdAndUpdate(
    commentId,
    {
      $set: {
        resolved: false,
        _resolvedBy: null,
        resolvedAt: null,
      },
    },
    { new: true }
  )
    .populate('_author', 'name email')
    .populate('_resolvedBy', 'name')
    .lean();

  logger.log('Comment unresolved', { commentId, unresolvedBy: user._id || user.id });

  return updatedComment;
}

/**
 * Get comment counts per block for a mailing
 * Returns object with blockId as key and { count, maxSeverity } as value
 */
async function getBlockCommentCounts(mailingId, user) {
  // Verify user has access to this mailing
  await verifyMailingAccess(mailingId, user);

  const results = await Comments.getBlockCommentCounts(mailingId);

  // Transform array to object for easier access
  const counts = {};
  for (const result of results) {
    if (result._id) {
      // Determine max severity
      let maxSeverity = 'info';
      if (result.hasBlocking) maxSeverity = 'blocking';
      else if (result.hasImportant) maxSeverity = 'important';

      counts[result._id] = {
        count: result.count,
        maxSeverity: maxSeverity,
      };
    }
  }

  return counts;
}

/**
 * Get total unresolved comment count for a mailing
 */
async function getUnresolvedCountByMailing(mailingId, user) {
  // Verify user has access to this mailing
  await verifyMailingAccess(mailingId, user);

  return Comments.countUnresolvedByMailing(mailingId);
}

/**
 * Capture block snapshot for comment
 */
function captureBlockSnapshot(mailing, blockId) {
  if (!blockId || !mailing.data) return null;

  const blocks = mailing.data?.mainBlocks?.blocks || [];
  const index = blocks.findIndex((b) => b.id === blockId);

  if (index === -1) return null;

  return {
    index,
    type: blocks[index].type,
    capturedAt: new Date(),
  };
}
