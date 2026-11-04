'use strict';

const { Schema } = require('mongoose');
const { ObjectId } = Schema.Types;
const { UserModel } = require('../../constant/model.names.js');

/**
 * One follow of production by a copy (ADR 0019): when it ran, who started it
 * (a person, or the night), how it ended, and what it did to each item. The
 * copy's skills and expertises page shows the last one.
 */
const FollowedItemSchema = new Schema(
  {
    kind: { type: String, enum: ['skill', 'expertise'], required: true },
    id: { type: String, required: true },
    version: { type: String, default: null },
    reason: { type: String, default: null },
    message: { type: String, default: null },
  },
  { _id: false }
);

const SkillsFollowSchema = new Schema({
  status: {
    type: String,
    enum: ['succeeded', 'partial', 'failed'],
    required: true,
  },
  // Why the follow wrote nothing, when it failed: never an address.
  message: { type: String, default: null },
  origin: { type: String, default: '' },
  by: { type: String, default: '' },
  _by: { type: ObjectId, ref: UserModel, default: null },
  startedAt: { type: Date, required: true },
  finishedAt: { type: Date, required: true },
  created: { type: [FollowedItemSchema], default: [] },
  updated: { type: [FollowedItemSchema], default: [] },
  upToDate: { type: [FollowedItemSchema], default: [] },
  kept: { type: [FollowedItemSchema], default: [] },
  failed: { type: [FollowedItemSchema], default: [] },
});

SkillsFollowSchema.index({ startedAt: -1 });

module.exports = SkillsFollowSchema;
