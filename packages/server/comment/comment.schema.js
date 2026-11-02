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

// Review decision enum — reviewer's concrete "validate" mechanism (see
// docs/plans/rbac-refonte.md section 3.4). null = a normal comment.
const COMMENT_DECISIONS = Object.freeze({
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'changes_requested',
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
    },

    // Reference to the group (denormalized for efficient queries)
    _company: {
      type: ObjectId,
      ref: GroupModel,
      required: true,
    },

    // Block identification
    blockId: {
      type: String,
      required: false, // null = mailing-level comment
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
    decision: {
      type: String,
      // Mongoose's enum validator rejects `null` unless it's explicitly
      // listed — required here since this field defaults to null.
      enum: [...Object.values(COMMENT_DECISIONS), null],
      default: null,
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
    },

    // Resolution status
    resolved: {
      type: Boolean,
      default: false,
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
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes for common queries
CommentSchema.index({ _mailing: 1, blockId: 1 }); // getByMailing avec blockId
CommentSchema.index({ _mailing: 1, isDeleted: 1, resolved: 1 }); // getByMailing, aggregate, countDocuments
CommentSchema.index({ _company: 1, resolved: 1, createdAt: -1 }); // dashboard company (si utilisé ailleurs)
CommentSchema.index({ _parentComment: 1, createdAt: 1 }); // deleteWithReplies + chargement des replies

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

// Static: ids (as strings) of the mailings whose latest root comment is an
// approval. A comment posted after the approval, whatever it says, lifts it: a
// plain comment already is an implicit request for changes (plan section 3.4).
CommentSchema.statics.findApprovedMailingIds = async function (mailingIds) {
  const latestByMailing = await this.aggregate([
    {
      $match: {
        _mailing: { $in: mailingIds },
        _parentComment: null,
        isDeleted: false,
      },
    },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$_mailing', decision: { $first: '$decision' } } },
    { $match: { decision: COMMENT_DECISIONS.APPROVED } },
  ]);
  return latestByMailing.map((item) => item._id.toString());
};

// Static: Get comment counts grouped by block with severity info
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
        hasImportant: {
          $max: { $cond: [{ $eq: ['$severity', 'important'] }, 1, 0] },
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
  COMMENT_DECISIONS,
};
