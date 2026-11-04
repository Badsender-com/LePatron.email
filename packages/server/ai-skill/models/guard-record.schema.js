'use strict';

const { Schema } = require('mongoose');
const { ObjectId } = Schema.Types;
const { UserModel } = require('../../constant/model.names.js');

/**
 * A decision taken after the publication guard (ADR 0019): the person
 * published the version anyway, or cancelled. Kept with the version, as a
 * summary of what the guard showed; the outputs themselves are not stored.
 */
const GuardRecordSchema = new Schema(
  {
    decision: {
      type: String,
      enum: ['published', 'cancelled'],
      required: true,
    },
    by: { type: ObjectId, ref: UserModel },
    // The assistant that asked, when the decision came through MCP.
    application: { type: String, default: null },
    at: { type: Date, default: Date.now },
    cases: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    // The feature skills concerned that had no test case.
    missing: { type: [String], default: [] },
  },
  { _id: false }
);

module.exports = { GuardRecordSchema };
