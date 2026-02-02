'use strict';

const asyncHandler = require('express-async-handler');

const notificationService = require('./notification.service.js');

module.exports = {
  list: asyncHandler(list),
  getUnreadCount: asyncHandler(getUnreadCount),
  markAsRead: asyncHandler(markAsRead),
  markAllAsRead: asyncHandler(markAllAsRead),
};

/**
 * @api {get} /notifications list notifications for current user
 * @apiPermission user
 * @apiName GetNotifications
 * @apiGroup Notifications
 *
 * @apiQuery {Number} [limit=20] Maximum number of notifications
 * @apiQuery {Number} [skip=0] Number of notifications to skip
 * @apiQuery {Boolean} [unreadOnly=false] Filter to unread only
 *
 * @apiSuccess {Notification[]} items List of notifications
 */
async function list(req, res) {
  const {
    user,
    query: { limit, skip, unreadOnly },
  } = req;

  const userId = user._id || user.id;

  const notifications = await notificationService.findByUser({
    userId,
    limit: limit ? parseInt(limit, 10) : 20,
    skip: skip ? parseInt(skip, 10) : 0,
    unreadOnly: unreadOnly === 'true',
  });

  res.json({ items: notifications });
}

/**
 * @api {get} /notifications/unread-count get unread notification count
 * @apiPermission user
 * @apiName GetUnreadCount
 * @apiGroup Notifications
 *
 * @apiSuccess {Number} count Unread notification count
 */
async function getUnreadCount(req, res) {
  const { user } = req;
  const userId = user._id || user.id;

  const count = await notificationService.getUnreadCount(userId);

  res.json({ count });
}

/**
 * @api {patch} /notifications/:notificationId/read mark notification as read
 * @apiPermission user
 * @apiName MarkNotificationAsRead
 * @apiGroup Notifications
 *
 * @apiParam {String} notificationId Notification ID
 *
 * @apiSuccess {Notification} notification Updated notification
 */
async function markAsRead(req, res) {
  const {
    user,
    params: { notificationId },
  } = req;

  const userId = user._id || user.id;

  const notification = await notificationService.markAsRead({
    notificationId,
    userId,
  });

  res.json(notification);
}

/**
 * @api {patch} /notifications/read-all mark all notifications as read
 * @apiPermission user
 * @apiName MarkAllNotificationsAsRead
 * @apiGroup Notifications
 *
 * @apiSuccess {Object} result Operation result
 */
async function markAllAsRead(req, res) {
  const { user } = req;
  const userId = user._id || user.id;

  const result = await notificationService.markAllAsRead(userId);

  res.json(result);
}
