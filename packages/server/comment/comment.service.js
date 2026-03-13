'use strict';

const mongoose = require('mongoose');
const { BadRequest, Forbidden, NotFound } = require('http-errors');

const { Comments, Mailings, Users } = require('../common/models.common.js');
const ERROR_CODES = require('../constant/error-codes.js');
const logger = require('../utils/logger.js');

/**
 * Validate that a string is a valid MongoDB ObjectId
 * @param {string} id - The ID to validate
 * @param {string} fieldName - Name of the field for error message
 * @throws {BadRequest} If ID is not a valid ObjectId
 */
function validateObjectId(id, fieldName = 'ID') {
  if (!id || !mongoose.isValidObjectId(id)) {
    throw new BadRequest(
      ERROR_CODES.INVALID_OBJECT_ID || `Invalid ${fieldName}`
    );
  }
}

/**
 * Find a comment by ID and throw NotFound if it doesn't exist or is deleted.
 * Reusable guard used across update/delete/resolve/unresolve.
 */
async function getCommentOrThrow(commentId) {
  const comment = await Comments.findById(commentId);
  if (!comment || comment.isDeleted) {
    throw new NotFound(ERROR_CODES.COMMENT_NOT_FOUND);
  }
  return comment;
}

/**
 * Validate that all mentioned user IDs belong to the given company.
 * Deduplicates IDs before querying to avoid false mismatches when the
 * client sends duplicate IDs (MongoDB $in deduplicates server-side).
 */
async function validateMentions(mentions, userCompanyId) {
  if (!mentions || mentions.length === 0) return;
  const uniqueIds = [...new Set(mentions.map(String))];
  const found = await Users.find({
    _id: { $in: uniqueIds },
    _company: userCompanyId,
  });
  if (found.length !== uniqueIds.length) {
    throw new BadRequest(ERROR_CODES.MENTION_USER_NOT_IN_GROUP);
  }
}

module.exports = {
  createComment,
  getByMailing,
  getById,
  updateComment,
  deleteComment,
  resolveComment,
  unresolveComment,
  getBlockCommentCounts,
  getUnresolvedCountByMailing,
};

/**
 * Populate options for _author that always returns at least { id } even if the
 * user has been deleted (or is the admin who has no DB document).
 * This ensures the frontend can still compare author IDs correctly.
 */
const POPULATE_AUTHOR = {
  path: '_author',
  select: 'name email id',
  transform: (doc, id) => doc || { id: id.toString() },
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

  // Super admin has access to all mailings
  if (user?.isAdmin) {
    return mailing;
  }

  const userCompanyId = getUserCompanyId(user);
  const mailingCompanyId = mailing._wireframe?._company;

  if (!userCompanyId || !mailingCompanyId) {
    throw new Forbidden(ERROR_CODES.COMMENT_MAILING_ACCESS_DENIED);
  }

  const hasAccess = String(userCompanyId) === String(mailingCompanyId);

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
    if (
      !parentComment ||
      parentComment.isDeleted ||
      parentComment._mailing.toString() !== mailingId
    ) {
      throw new BadRequest(ERROR_CODES.COMMENT_INVALID_PARENT);
    }
  }

  // Validate mentions belong to the mailing's company
  const userCompanyId = getUserCompanyId(user);
  const mentionCompanyId = mailing._wireframe?._company || userCompanyId;
  await validateMentions(mentions, mentionCompanyId);

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
  return Comments.findById(comment._id).populate(POPULATE_AUTHOR).lean();
}

/**
 * Find comments for a mailing with filters
 */
async function getByMailing({
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
    .populate(POPULATE_AUTHOR)
    .populate('_resolvedBy', 'name')
    .populate('mentions', 'name email')
    .sort({ createdAt: 1 })
    .lean(); // Use lean() to avoid User virtuals accessing unpopulated _company

  return comments;
}

/**
 * Find comment by ID with access verification
 * @param {string} commentId - The comment ID
 * @param {Object} user - The requesting user
 * @returns {Object} The comment
 * @throws {BadRequest} If commentId is invalid
 * @throws {NotFound} If comment doesn't exist
 * @throws {Forbidden} If user doesn't have access to the mailing
 */
async function getById(commentId, user) {
  validateObjectId(commentId, 'comment ID');

  const comment = await Comments.findById(commentId)
    .populate(POPULATE_AUTHOR)
    .populate('_resolvedBy', 'name')
    .populate('mentions', 'name email')
    .lean(); // Use lean() to avoid User virtuals accessing unpopulated _company

  if (!comment || comment.isDeleted) {
    throw new NotFound(ERROR_CODES.COMMENT_NOT_FOUND);
  }

  // Verify user has access to the mailing this comment belongs to
  await verifyMailingAccess(comment._mailing, user);

  return comment;
}

/**
 * Update a comment (text, category, severity)
 */
async function updateComment({ commentId, user, updates }) {
  const comment = await getCommentOrThrow(commentId);

  // Only the author can update their own comment
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

  // Handle mentions update — validate against the mailing's company
  if (updates.mentions !== undefined) {
    const companyId = user?.isAdmin ? comment._company : getUserCompanyId(user);
    await validateMentions(updates.mentions, companyId);
    updateData.mentions = updates.mentions;
  }

  const updatedComment = await Comments.findByIdAndUpdate(
    commentId,
    { $set: updateData },
    { new: true }
  )
    .populate(POPULATE_AUTHOR)
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
  const comment = await getCommentOrThrow(commentId);

  // Check permission: author, group admin, or super admin
  const userId = user._id || user.id;
  const isAuthor = comment._author.toString() === userId.toString();
  const isGroupAdmin = user.isAdmin || user.role === 'company_admin';

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
 * @param {string} commentId - The comment ID
 * @param {Object} user - The requesting user
 * @throws {BadRequest} If commentId is invalid or comment already resolved
 * @throws {NotFound} If comment doesn't exist
 * @throws {Forbidden} If user doesn't have access to the mailing
 */
async function resolveComment({ commentId, user }) {
  validateObjectId(commentId, 'comment ID');

  const comment = await getCommentOrThrow(commentId);

  // Verify user has access to the mailing this comment belongs to
  await verifyMailingAccess(comment._mailing, user);

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
    .populate(POPULATE_AUTHOR)
    .populate('_resolvedBy', 'name')
    .lean(); // Use lean() to avoid User virtuals accessing unpopulated _company

  logger.log('Comment resolved', {
    commentId,
    resolvedBy: user._id || user.id,
  });

  return updatedComment;
}

/**
 * Mark a comment as unresolved (reopen)
 * @param {string} commentId - The comment ID
 * @param {Object} user - The requesting user
 * @throws {BadRequest} If commentId is invalid or comment not resolved
 * @throws {NotFound} If comment doesn't exist
 * @throws {Forbidden} If user doesn't have access to the mailing
 */
async function unresolveComment({ commentId, user }) {
  validateObjectId(commentId, 'comment ID');

  const comment = await Comments.findById(commentId);

  if (!comment || comment.isDeleted) {
    throw new NotFound(ERROR_CODES.COMMENT_NOT_FOUND);
  }

  // Verify user has access to the mailing this comment belongs to
  await verifyMailingAccess(comment._mailing, user);

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
    .populate(POPULATE_AUTHOR)
    .populate('_resolvedBy', 'name')
    .lean();

  logger.log('Comment unresolved', {
    commentId,
    unresolvedBy: user._id || user.id,
  });

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
