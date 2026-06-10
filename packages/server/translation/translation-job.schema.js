'use strict';

const { Schema } = require('mongoose');

const ProgressSchema = new Schema(
  {
    currentBatch: { type: Number, default: 0 },
    totalBatches: { type: Number, default: 0 },
    keysTranslated: { type: Number, default: 0 },
    totalKeys: { type: Number, default: 0 },
  },
  { _id: false }
);

const ResultSchema = new Schema(
  {
    mailingId: String,
    mailingName: String,
    previewGenerated: Boolean,
    stats: { type: Schema.Types.Mixed },
    sourceLanguage: String,
    targetLanguage: String,
    warningKeys: [String],
  },
  { _id: false }
);

const TranslationJobSchema = new Schema(
  {
    jobId: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'translating', 'completed', 'failed', 'cancelled'],
      default: 'pending',
    },
    progress: { type: ProgressSchema, required: true },
    result: { type: ResultSchema, default: null },
    error: { type: String, default: null },
  },
  { timestamps: true }
);

TranslationJobSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 600 });

module.exports = TranslationJobSchema;
