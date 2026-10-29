'use strict';

const { Schema } = require('mongoose');
const { ObjectId } = Schema.Types;
const { UserModel, GroupModel } = require('../constant/model.names.js');

// What a feedback points at, with the version it was given on: a skill or an
// expertise changes, and a feedback only says something of the version read.
const ReferenceSchema = new Schema(
  {
    kind: { type: String, enum: ['skill', 'expertise', 'mailing'] },
    id: { type: String, required: true },
    version: { type: String, default: null },
  },
  { _id: false }
);

/**
 * A feedback a user sends from a connected application (ADR 0012): a rating, a
 * comment, what it refers to, and the retex, the session summary, kept only
 * when the group allows it and the user agreed to it for this feedback.
 * Removed at the end of the group's log retention.
 */
const McpFeedbackSchema = new Schema(
  {
    _company: { type: ObjectId, ref: GroupModel, required: true },
    _user: { type: ObjectId, ref: UserModel, required: true },
    clientId: { type: String, default: '' },
    rating: { type: String, enum: ['up', 'down'], required: true },
    comment: { type: String, default: '' },
    references: { type: [ReferenceSchema], default: [] },
    retex: { type: String, default: null },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

McpFeedbackSchema.index({ createdAt: -1 });
// The group's log retention, as for the skill invocations: no scheduler.
McpFeedbackSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = McpFeedbackSchema;
