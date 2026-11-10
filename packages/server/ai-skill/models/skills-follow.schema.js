'use strict';

const { Schema } = require('mongoose');
const { ObjectId } = Schema.Types;
const { UserModel } = require('../../constant/model.names.js');

/**
 * One follow of production by a copy (ADR 0019): when it ran, who started it
 * (a person, or the night), how it ended, and what it did to each item. The
 * copy's skills and expertises page shows the last one.
 *
 * A follow is recorded as `running` when it starts: the database holds one
 * running follow at most, so the record is the lock that keeps two follows
 * apart, between processes and between instances (services/
 * skills-follow-lock.js). One that outlives `expiresAt` was interrupted.
 */
const WarningSchema = new Schema(
  {
    code: { type: String, required: true },
    expertiseIds: { type: [String], default: undefined },
  },
  { _id: false }
);

const FollowedItemSchema = new Schema(
  {
    kind: { type: String, enum: ['skill', 'expertise'], required: true },
    // Null for an item production answered whose id cannot be read.
    id: { type: String, default: null },
    version: { type: String, default: null },
    // Why it was kept (`kept_on_copy`, `local_only`), and whether production
    // changed since, for one kept on the copy.
    reason: { type: String, default: null },
    productionChanged: { type: Boolean },
    // Why it failed: an ERROR_CODES entry, and the field of production's
    // answer refused, when it is one.
    code: { type: String, default: null },
    field: { type: String },
    // The item of the copy its work went to.
    copyId: { type: String },
    warnings: { type: [WarningSchema], default: undefined },
  },
  { _id: false }
);

const SkillsFollowSchema = new Schema({
  status: {
    type: String,
    enum: ['running', 'succeeded', 'partial', 'failed'],
    required: true,
  },
  // Why the follow wrote nothing, when it failed: a word and a code the page
  // translates, and a sentence for the logs (`message`), never an address.
  reason: { type: String, default: null },
  code: { type: String, default: null },
  message: { type: String, default: null },
  origin: { type: String, default: '' },
  // A person's button, or the night's scheduled command (`by` is then empty).
  trigger: { type: String, enum: ['manual', 'night'], default: 'manual' },
  by: { type: String, default: '' },
  _by: { type: ObjectId, ref: UserModel, default: null },
  startedAt: { type: Date, required: true },
  // Until when a running follow holds the lock.
  expiresAt: { type: Date },
  finishedAt: { type: Date },
  created: { type: [FollowedItemSchema], default: [] },
  updated: { type: [FollowedItemSchema], default: [] },
  upToDate: { type: [FollowedItemSchema], default: [] },
  kept: { type: [FollowedItemSchema], default: [] },
  moved: { type: [FollowedItemSchema], default: [] },
  removed: { type: [FollowedItemSchema], default: [] },
  failed: { type: [FollowedItemSchema], default: [] },
});

SkillsFollowSchema.index({ startedAt: -1 });
// One running follow at most: the lock.
SkillsFollowSchema.index(
  { status: 1 },
  { unique: true, partialFilterExpression: { status: 'running' } }
);

module.exports = SkillsFollowSchema;
