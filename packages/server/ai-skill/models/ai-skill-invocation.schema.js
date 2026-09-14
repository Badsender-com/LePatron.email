'use strict';

const { Schema } = require('mongoose');
const { ObjectId, Mixed } = Schema.Types;
const {
  UserModel,
  GroupModel,
  LePatronSkillModel,
} = require('../../constant/model.names.js');
const { InvocationStatusValues } = require('../constant/skill-constants.js');

const ExpertiseConsumedSchema = new Schema(
  {
    expertiseId: { type: String, required: true },
    versionNumber: { type: Number },
  },
  { _id: false }
);

const ResolvedConfigSourceSchema = new Schema(
  {
    provider: { type: String },
    model: { type: String },
    temperature: { type: String },
    maxTokens: { type: String },
    topP: { type: String },
  },
  { _id: false }
);

const ResolvedConfigSchema = new Schema(
  {
    provider: { type: String },
    model: { type: String },
    temperature: { type: Number },
    maxTokens: { type: Number },
    topP: { type: Number },
    source: { type: ResolvedConfigSourceSchema },
  },
  { _id: false }
);

const TokenUsageSchema = new Schema(
  {
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    cachedTokens: { type: Number, default: 0 },
  },
  { _id: false }
);

const InvocationErrorSchema = new Schema(
  {
    code: { type: String },
    message: { type: String },
    stack: { type: String },
  },
  { _id: false }
);

/**
 * Réservé étape 2 (RAG) — optional human-in-the-loop feedback on the
 * invocation output. No route writes it in v1 (the Playground has its OWN
 * feedback on AIPlaygroundRun, independent from this one): the field exists
 * so vetted examples can later seed a RAG layer without a migration.
 * Cf. docs/REVIEW_GUIDE_AI_MODULES.md.
 */
const InvocationFeedbackSchema = new Schema(
  {
    rating: { type: String, enum: ['positive', 'negative', 'neutral'] },
    score: { type: Number, min: 1, max: 5 },
    ratedBy: { type: ObjectId, ref: UserModel },
    ratedAt: { type: Date },
    comment: { type: String },
    correctedOutput: { type: Mixed },
  },
  { _id: false }
);

const AISkillInvocationSchema = new Schema(
  {
    _skill: { type: ObjectId, ref: LePatronSkillModel },
    skillId: { type: String, required: true },
    // Format "<major>.<minor>", e.g. "1.0", "2.3".
    skillVersion: { type: String },

    _company: { type: ObjectId, ref: GroupModel, required: true },
    _user: { type: ObjectId, ref: UserModel, default: null },
    // WHO issued this invocation, for analytics: 'playground', a 'poc.*'
    // prefix, or a productive feature name. Deliberately NOT called
    // `featureType`: that name belongs to AIFeatureConfig, where it means the
    // engine type ('translation' | 'skill') — an orthogonal axis (see invoke()).
    invocationSource: { type: String },

    // Réservé étape 2 (DSE v2) — never populated in v1; kept so the analytics
    // shape is stable when prompt variants land. Cf. docs/REVIEW_GUIDE_AI_MODULES.md.
    variantPath: { type: [String], default: [] },

    expertiseConsumed: { type: [ExpertiseConsumedSchema], default: [] },

    provider: { type: String },
    model: { type: String },

    // Nullable when the Group has logSkillInvocationContent === false (RGPD strict).
    input: { type: Mixed, default: null },
    output: { type: Mixed, default: null },
    rawOutput: { type: String, default: null },

    resolvedConfig: { type: ResolvedConfigSchema, default: () => ({}) },

    startedAt: { type: Date, default: Date.now },
    // When Mongo may delete this document, computed at write time from the
    // Group's logRetentionDays (see the TTL index below). Null means "never
    // expires" as far as the TTL monitor is concerned — only documents written
    // before the retention migration are in that state.
    expiresAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    latencyMs: { type: Number, default: null },
    tokenUsage: { type: TokenUsageSchema, default: () => ({}) },

    status: {
      type: String,
      enum: InvocationStatusValues,
      required: true,
    },
    error: { type: InvocationErrorSchema, default: null },
    feedback: { type: InvocationFeedbackSchema, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

AISkillInvocationSchema.index({ _company: 1, startedAt: -1 });
AISkillInvocationSchema.index({ skillId: 1, startedAt: -1 });
AISkillInvocationSchema.index({ status: 1 });
// The Invocations tab default view has no skillId/groupId filter (only the
// non-productive invocationSource exclusion) and sorts by startedAt — without
// this index it collection-scans.
AISkillInvocationSchema.index({ startedAt: -1 });
// RGPD retention, enforced by Mongo's own TTL monitor rather than a scheduled
// job: retention is per-Group (Group.logRetentionDays), so the deadline is
// stamped on each document at write time and this index expires it in place.
// Same mechanism as translation-job.schema.js — no scheduler, no extra
// dependency, and nothing to keep running per worker.
AISkillInvocationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = AISkillInvocationSchema;
