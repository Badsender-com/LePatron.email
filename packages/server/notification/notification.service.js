'use strict';

const { Notifications } = require('../common/models.common.js');
const { NOTIFICATION_TYPES } = require('./notification.schema.js');
const ERROR_CODES = require('../constant/error-codes.js');
const { NotFound } = require('http-errors');
const logger = require('../utils/logger.js');

module.exports = {
  createMentionNotifications,
  createReplyNotification,
  createResolvedNotification,
  findByUser,
  findById,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteByComment,
};

/**
 * Create notifications for mentioned users
 */
async function createMentionNotifications({
  comment,
  mailing,
  actor,
  mentionedUserIds,
}) {
  const notifications = mentionedUserIds.map((userId) => ({
    _recipient: userId,
    _company: comment._company,
    type: NOTIFICATION_TYPES.COMMENT_MENTION,
    _mailing: mailing._id,
    _comment: comment._id,
    _actor: actor._id || actor.id,
    actorName: actor.name,
    mailingName: mailing.name,
    commentPreview: truncateText(comment.text, 100),
  }));

  const created = await Notifications.insertMany(notifications);

  logger.log('Mention notifications created', {
    count: created.length,
    mailingId: mailing._id,
    commentId: comment._id,
  });

  return created;
}

/**
 * Create notification for comment reply
 */
async function createReplyNotification({
  comment,
  parentComment,
  mailing,
  actor,
}) {
  const notification = await Notifications.create({
    _recipient: parentComment._author,
    _company: comment._company,
    type: NOTIFICATION_TYPES.COMMENT_REPLY,
    _mailing: mailing._id,
    _comment: comment._id,
    _actor: actor._id || actor.id,
    actorName: actor.name,
    mailingName: mailing.name,
    commentPreview: truncateText(comment.text, 100),
  });

  logger.log('Reply notification created', {
    recipientId: parentComment._author,
    commentId: comment._id,
  });

  return notification;
}

/**
 * Create notification when comment is resolved
 */
async function createResolvedNotification({ comment, mailing, actor }) {
  const notification = await Notifications.create({
    _recipient: comment._author,
    _company: comment._company,
    type: NOTIFICATION_TYPES.COMMENT_RESOLVED,
    _mailing: mailing._id,
    _comment: comment._id,
    _actor: actor._id || actor.id,
    actorName: actor.name,
    mailingName: mailing.name,
    commentPreview: truncateText(comment.text, 100),
  });

  logger.log('Resolved notification created', {
    recipientId: comment._author,
    commentId: comment._id,
  });

  return notification;
}

/**
 * Find notifications for a user with pagination
 */
async function findByUser({ userId, limit = 20, skip = 0, unreadOnly = false }) {
  const query = { _recipient: userId };

  if (unreadOnly) {
    query.read = false;
  }

  const notifications = await Notifications.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('_actor', 'name')
    .populate('_mailing', 'name')
    .lean();

  return notifications;
}

/**
 * Find notification by ID
 */
async function findById(notificationId) {
  const notification = await Notifications.findById(notificationId)
    .populate('_actor', 'name')
    .populate('_mailing', 'name');

  if (!notification) {
    throw new NotFound(ERROR_CODES.NOTIFICATION_NOT_FOUND);
  }

  return notification;
}

/**
 * Mark a notification as read
 */
async function markAsRead({ notificationId, userId }) {
  const notification = await Notifications.findOneAndUpdate(
    { _id: notificationId, _recipient: userId },
    { read: true, readAt: new Date() },
    { new: true }
  );

  if (!notification) {
    throw new NotFound(ERROR_CODES.NOTIFICATION_NOT_FOUND);
  }

  logger.log('Notification marked as read', { notificationId });

  return notification;
}

/**
 * Mark all notifications as read for a user
 */
async function markAllAsRead(userId) {
  const result = await Notifications.markAllReadByUser(userId);

  logger.log('All notifications marked as read', {
    userId,
    modifiedCount: result.modifiedCount,
  });

  return { modifiedCount: result.modifiedCount };
}

/**
 * Get unread notification count for a user
 */
async function getUnreadCount(userId) {
  return Notifications.countUnreadByUser(userId);
}

/**
 * Delete all notifications for a comment (used when comment is deleted)
 */
async function deleteByComment(commentId) {
  const result = await Notifications.deleteMany({ _comment: commentId });

  logger.log('Notifications deleted for comment', {
    commentId,
    deletedCount: result.deletedCount,
  });

  return result;
}

/**
 * Truncate text to specified length with ellipsis
 */
function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}
