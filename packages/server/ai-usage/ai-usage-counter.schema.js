'use strict';

const { Schema } = require('mongoose');

/**
 * One counter per (subject, window): `user:<id>:minute:2026-10-01T09:41`,
 * `group:<id>:day:2026-10-01`. Fixed windows, incremented atomically, so the
 * limit holds across every instance of the app — an in-memory counter would
 * multiply it by the number of dynos.
 */
const AIUsageCounterSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    count: { type: Number, required: true, default: 0 },
    // A window that has closed is dead weight: the TTL index removes it.
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false }
);

AIUsageCounterSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = AIUsageCounterSchema;
