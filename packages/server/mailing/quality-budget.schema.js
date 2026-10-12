'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

// A spent day stays this long, for whoever wonders why a check stopped
// answering, then MongoDB removes it (TTL index below).
const KEEP_SPENT_SECONDS = 7 * 24 * 60 * 60;

/**
 * What a company spent of a paid quality lookup today (Web Risk, for now):
 * one document per scope, kind and day, counted with an atomic conditional
 * increment (quality-threats.service.js). In the database rather than in
 * memory because every worker of the cluster must draw on the same budget.
 */
const QualityBudgetSchema = new Schema(
  {
    // The company's id, or 'admin' for the user without one.
    scope: {
      type: String,
      required: true,
    },
    kind: {
      type: String,
      required: true,
    },
    // UTC calendar day, YYYY-MM-DD.
    day: {
      type: String,
      required: true,
    },
    count: {
      type: Number,
      required: true,
      default: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

QualityBudgetSchema.index({ scope: 1, kind: 1, day: 1 }, { unique: true });
QualityBudgetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = { QualityBudgetSchema, KEEP_SPENT_SECONDS };
