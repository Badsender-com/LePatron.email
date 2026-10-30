'use strict';

const { Schema } = require('mongoose');
const { ObjectId } = Schema.Types;
const { UserModel, GroupModel } = require('../constant/model.names.js');

/**
 * A call a connected application made to the MCP server (ADR 0012): metadata
 * only, never what LePatron answered nor what the user typed. Removed at the
 * end of the group's log retention.
 */
const McpCallLogSchema = new Schema(
  {
    _company: { type: ObjectId, ref: GroupModel },
    _user: { type: ObjectId, ref: UserModel },
    clientId: { type: String, default: '' },
    method: { type: String, required: true },
    // The tool or the prompt, for a call that names one.
    name: { type: String, default: null },
    objectIds: { type: [String], default: [] },
    durationMs: { type: Number, default: 0 },
    outcome: {
      type: String,
      enum: ['ok', 'error', 'rate_limited'],
      required: true,
    },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

McpCallLogSchema.index({ _company: 1, createdAt: -1 });
// The group's log retention, as for the skill invocations: no scheduler.
McpCallLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = McpCallLogSchema;
