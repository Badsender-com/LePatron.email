'use strict';

const { Types } = require('mongoose');
const { NotFound, Forbidden, BadRequest } = require('http-errors');

const { Comments, Mailings, Users } = require('../common/models.common.js');
const ERROR_CODES = require('../constant/error-codes.js');
const notificationService = require('../notification/notification.service.js');
const logger = require('../utils/logger.js');

module.exports = {
  createComment,
  findByMailing,
  findById,
  updateComment,
  deleteComment,
  resolveComment,
  getBlockCommentCounts,
  getUnresolvedCountByMailing,
};

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
  const mailing = await Mailings.findById(mailingId);
  if (!mailing) {
    throw new NotFound(ERROR_CODES.MAILING_NOT_FOUND);
  }

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
  if (mentions && mentions.length > 0) {
    const mentionedUsers = await Users.find({
      _id: { $in: mentions },
      _company: user._company || user.group?.id,
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
    _company: mailing._company || mailing._wireframe?._company,
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

  // Create notifications for mentions
  if (mentions && mentions.length > 0) {
    await notificationService.createMentionNotifications({
      comment,
      mailing,
      actor: user,
      mentionedUserIds: mentions,
    });
  }

  // Create notification for reply
  if (parentCommentId) {
    const parentComment = await Comments.findById(parentCommentId);
    if (
      parentComment &&
      parentComment._author.toString() !== (user._id || user.id).toString()
    ) {
      await notificationService.createReplyNotification({
        comment,
        parentComment,
        mailing,
        actor: user,
      });
    }
  }

  logger.log('Comment created', { commentId: comment._id, mailingId });

  return comment.populate('_author', 'name email');
}

/**
 * Find comments for a mailing with filters
 */
async function findByMailing({
  mailingId,
  blockId,
  resolved,
  includeReplies = true,
}) {
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
    .sort({ createdAt: 1 });

  return comments;
}

/**
 * Find comment by ID
 */
async function findById(commentId) {
  const comment = await Comments.findById(commentId)
    .populate('_author', 'name email')
    .populate('_resolvedBy', 'name')
    .populate('mentions', 'name email');

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
      const mentionedUsers = await Users.find({
        _id: { $in: updates.mentions },
        _company: user._company || user.group?.id,
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
    .populate('mentions', 'name email');

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
    .populate('_resolvedBy', 'name');

  // Create notification for comment author
  if (comment._author.toString() !== (user._id || user.id).toString()) {
    const mailing = await Mailings.findById(comment._mailing);
    await notificationService.createResolvedNotification({
      comment: updatedComment,
      mailing,
      actor: user,
    });
  }

  logger.log('Comment resolved', { commentId, resolvedBy: user._id || user.id });

  return updatedComment;
}

/**
 * Get comment counts per block for a mailing
 * Returns object with blockId as key and count as value
 */
async function getBlockCommentCounts(mailingId) {
  const results = await Comments.getBlockCommentCounts(mailingId);

  // Transform array to object for easier access
  const counts = {};
  for (const result of results) {
    if (result._id) {
      counts[result._id] = result.count;
    }
  }

  return counts;
}

/**
 * Get total unresolved comment count for a mailing
 */
async function getUnresolvedCountByMailing(mailingId) {
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
