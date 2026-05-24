'use strict';

const { Schema } = require('mongoose');
const { ObjectId, Mixed } = Schema.Types;
const {
  UserModel,
  AIPlaygroundScenarioModel,
  AISkillInvocationModel,
} = require('../../constant/model.names.js');
const {
  RunStatusValues,
  FeedbackRatingValues,
} = require('../constant/playground-constants.js');

const ResolvedSkillRefSchema = new Schema(
  {
    skillId: { type: String, required: true },
    versionMajor: { type: Number, required: true },
    versionMinor: { type: Number, required: true },
  },
  { _id: false }
);

const ResolvedExpertiseRefSchema = new Schema(
  {
    expertiseId: { type: String, required: true },
    versionMajor: { type: Number, required: true },
    versionMinor: { type: Number, required: true },
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

const RunFeedbackSchema = new Schema(
  {
    rating: { type: String, enum: FeedbackRatingValues },
    score: { type: Number, min: 1, max: 5 },
    comment: { type: String },
    ratedBy: { type: ObjectId, ref: UserModel },
    ratedAt: { type: Date },
  },
  { _id: false }
);

const AIPlaygroundRunSchema = new Schema(
  {
    _scenario: {
      type: ObjectId,
      ref: AIPlaygroundScenarioModel,
      required: true,
    },
    scenarioSnapshot: { type: Mixed, required: true },

    resolvedSkill: { type: ResolvedSkillRefSchema, required: true },
    resolvedExpertise: { type: [ResolvedExpertiseRefSchema], default: [] },
    composedInput: { type: Mixed, default: {} },

    _invocation: { type: ObjectId, ref: AISkillInvocationModel },

    // Denormalised for fast listing.
    output: { type: Mixed, default: null },
    status: { type: String, enum: RunStatusValues },
    latencyMs: { type: Number, default: null },
    tokenUsage: { type: TokenUsageSchema, default: () => ({}) },
    errorMessage: { type: String, default: null },

    feedback: { type: RunFeedbackSchema, default: null },
    isGolden: { type: Boolean, default: false },

    createdBy: { type: ObjectId, ref: UserModel, required: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

AIPlaygroundRunSchema.index({ _scenario: 1, createdAt: -1 });
AIPlaygroundRunSchema.index({ isGolden: 1 });
AIPlaygroundRunSchema.index({ status: 1 });
// Belt-and-suspenders: at most one golden run per scenario (DB-level invariant
// on top of the mark-golden service logic). Cf. Q6 in the v1.2 plan.
AIPlaygroundRunSchema.index(
  { _scenario: 1 },
  {
    unique: true,
    partialFilterExpression: { isGolden: true },
    name: 'one_golden_per_scenario',
  }
);

module.exports = AIPlaygroundRunSchema;
