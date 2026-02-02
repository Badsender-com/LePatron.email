'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema.Types;
const {
  UserModel,
  GroupModel,
  MailingModel,
  CommentModel,
} = require('../constant/model.names.js');

// Notification type enum
const NOTIFICATION_TYPES = Object.freeze({
  COMMENT_MENTION: 'comment_mention',
  COMMENT_REPLY: 'comment_reply',
  COMMENT_RESOLVED: 'comment_resolved',
  COMMENT_NEW: 'comment_new',
});

const NotificationSchema = new Schema(
  {
    // Recipient of the notification
    _recipient: {
      type: ObjectId,
      ref: UserModel,
      required: true,
      index: true,
    },

    // Group reference for scoping
    _company: {
      type: ObjectId,
      ref: GroupModel,
      required: true,
    },

    // Notification type
    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPES),
      required: true,
    },

    // Reference to related entities
    _mailing: {
      type: ObjectId,
      ref: MailingModel,
    },
    _comment: {
      type: ObjectId,
      ref: CommentModel,
    },
    _actor: {
      type: ObjectId,
      ref: UserModel,
    },

    // Denormalized data for quick display without joins
    actorName: {
      type: String,
    },
    mailingName: {
      type: String,
    },
    commentPreview: {
      type: String, // First 100 chars of comment
      maxlength: 100,
    },

    // Read status
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },

    // Email notification tracking (for future V2)
    emailSent: {
      type: Boolean,
      default: false,
    },
    emailSentAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for common queries
NotificationSchema.index({ _recipient: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ _recipient: 1, createdAt: -1 });

// TTL index to auto-delete old notifications (90 days)
NotificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

// Static: Count unread notifications for a user
NotificationSchema.statics.countUnreadByUser = async function (userId) {
  return this.countDocuments({
    _recipient: userId,
    read: false,
  });
};

// Static: Mark all as read for a user
NotificationSchema.statics.markAllReadByUser = async function (userId) {
  return this.updateMany(
    { _recipient: userId, read: false },
    { read: true, readAt: new Date() }
  );
};

module.exports = {
  NotificationSchema,
  NOTIFICATION_TYPES,
};
