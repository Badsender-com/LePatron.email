'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema.Types;
const {
  UserModel,
  MailingModel,
  GroupModel,
  CommentModel,
} = require('../constant/model.names.js');

// Comment category enum
const COMMENT_CATEGORIES = Object.freeze({
  DESIGN: 'design',
  CONTENT: 'content',
  GENERAL: 'general',
});

// Comment severity enum
const COMMENT_SEVERITIES = Object.freeze({
  INFO: 'info',
  IMPORTANT: 'important',
  BLOCKING: 'blocking',
});

const BlockSnapshotSchema = new Schema(
  {
    index: { type: Number },
    type: { type: String },
    capturedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const CommentSchema = new Schema(
  {
    // Reference to the mailing
    _mailing: {
      type: ObjectId,
      ref: MailingModel,
      required: true,
      index: true,
    },

    // Reference to the group (denormalized for efficient queries)
    _company: {
      type: ObjectId,
      ref: GroupModel,
      required: true,
      index: true,
    },

    // Block identification
    blockId: {
      type: String,
      required: false, // null = mailing-level comment
      index: true,
    },

    // Snapshot of block position at comment time (for deleted block handling)
    blockSnapshot: {
      type: BlockSnapshotSchema,
      required: false,
    },

    // Comment content
    text: {
      type: String,
      required: [true, 'Comment text is required'],
      maxlength: [5000, 'Comment text cannot exceed 5000 characters'],
    },

    // Category and severity
    category: {
      type: String,
      enum: Object.values(COMMENT_CATEGORIES),
      default: COMMENT_CATEGORIES.GENERAL,
    },
    severity: {
      type: String,
      enum: Object.values(COMMENT_SEVERITIES),
      default: COMMENT_SEVERITIES.INFO,
    },

    // Author
    _author: {
      type: ObjectId,
      ref: UserModel,
      required: true,
    },
    authorName: {
      type: String, // Denormalized for display even if user deleted
      required: true,
    },

    // Threading
    _parentComment: {
      type: ObjectId,
      ref: CommentModel,
      default: null,
      index: true,
    },

    // Resolution status
    resolved: {
      type: Boolean,
      default: false,
      index: true,
    },
    _resolvedBy: {
      type: ObjectId,
      ref: UserModel,
    },
    resolvedAt: {
      type: Date,
    },

    // Mentions (array of user IDs)
    mentions: [
      {
        type: ObjectId,
        ref: UserModel,
      },
    ],

    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes for common queries
CommentSchema.index({ _mailing: 1, resolved: 1 });
CommentSchema.index({ _mailing: 1, blockId: 1 });
CommentSchema.index({ _company: 1, resolved: 1, createdAt: -1 });
CommentSchema.index({ _parentComment: 1, createdAt: 1 });
CommentSchema.index({ mentions: 1, createdAt: -1 });
CommentSchema.index({ _mailing: 1, isDeleted: 1, resolved: 1 });

// Virtual for checking if this is a root comment (not a reply)
CommentSchema.virtual('isRootComment').get(function () {
  return this._parentComment === null;
});

// Static: Count unresolved root comments for a mailing
CommentSchema.statics.countUnresolvedByMailing = async function (mailingId) {
  return this.countDocuments({
    _mailing: mailingId,
    _parentComment: null, // Only count root comments
    resolved: false,
    isDeleted: false,
  });
};

// Static: Get comment counts grouped by block
CommentSchema.statics.getBlockCommentCounts = async function (mailingId) {
  return this.aggregate([
    {
      $match: {
        _mailing: new mongoose.Types.ObjectId(mailingId),
        _parentComment: null,
        resolved: false,
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: '$blockId',
        count: { $sum: 1 },
        hasBlocking: {
          $max: { $cond: [{ $eq: ['$severity', 'blocking'] }, 1, 0] },
        },
      },
    },
  ]);
};

// Static: Delete comment and its replies (cascade)
CommentSchema.statics.deleteWithReplies = async function (commentId) {
  // Soft delete the comment and all its replies
  await this.updateMany(
    {
      $or: [{ _id: commentId }, { _parentComment: commentId }],
    },
    {
      isDeleted: true,
    }
  );
};

module.exports = {
  CommentSchema,
  COMMENT_CATEGORIES,
  COMMENT_SEVERITIES,
};
