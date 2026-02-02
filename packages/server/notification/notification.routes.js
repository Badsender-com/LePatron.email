'use strict';

const express = require('express');

const router = express.Router();

const { GUARD_USER } = require('../account/auth.guard.js');
const notifications = require('./notification.controller.js');

router.get('', GUARD_USER, notifications.list);
router.get('/unread-count', GUARD_USER, notifications.getUnreadCount);
router.patch('/read-all', GUARD_USER, notifications.markAllAsRead);
router.patch('/:notificationId/read', GUARD_USER, notifications.markAsRead);

module.exports = router;
