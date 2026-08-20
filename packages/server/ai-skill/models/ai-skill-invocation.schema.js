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

module.exports = AISkillInvocationSchema;
