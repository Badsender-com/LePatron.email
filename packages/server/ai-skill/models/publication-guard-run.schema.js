'use strict';

const { Schema } = require('mongoose');

/**
 * One run of the publication guard (ADR 0019), as a task of the server: it
 * is recorded as `running` when it starts, and the replay goes on after the
 * request that started it has answered. The person who started it reads it
 * again until it is `done`, with the cases before and after and the key its
 * publication requires, or `failed`, with why (`code`). One still running
 * past `expiresAt` was interrupted: its process is gone.
 */
const TargetSchema = new Schema(
  {
    kind: { type: String, enum: ['skill', 'expertise'], required: true },
    id: { type: String, required: true },
    // `major.minor`
    version: { type: String, required: true },
  },
  { _id: false }
);

const PublicationGuardRunSchema = new Schema({
  status: {
    type: String,
    enum: ['running', 'done', 'failed'],
    required: true,
  },
  // Who started it, the only one who reads it, as the key names them.
  by: { type: String, required: true },
  targets: { type: [TargetSchema], default: [] },
  // What it replays, said before it runs.
  usedBy: { type: [Schema.Types.Mixed], default: [] },
  calls: { type: Number, default: 0 },
  maxCalls: { type: Number, default: 0 },
  notReplayed: { type: Number, default: 0 },
  missing: { type: [String], default: [] },
  // What it showed, once done.
  cases: { type: [Schema.Types.Mixed], default: undefined },
  key: { type: String },
  // Why it failed: an ERROR_CODES entry.
  code: { type: String },
  startedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  finishedAt: { type: Date },
  // Removed by the database once its key can no longer publish.
  deleteAt: { type: Date, required: true },
});

PublicationGuardRunSchema.index({ deleteAt: 1 }, { expireAfterSeconds: 0 });
PublicationGuardRunSchema.index({ by: 1, status: 1 });

module.exports = PublicationGuardRunSchema;
