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
    // Generous but bounded: the daily quota only guards /execute, so every
    // other writable text field needs its own ceiling. Not a product rule —
    // a bound on unbounded storage.
    comment: { type: String, maxlength: 2000 },
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

    // When Mongo may delete this run, stamped at write time (see the TTL index
    // below). Null means "never expires": golden runs are durable references
    // for regression / comparison, so markGolden clears the deadline and
    // unmarkGolden puts it back.
    expiresAt: { type: Date, default: null },

    // Nullable: the Playground is a super-admin tool and the super-admin
    // pseudo-account (config.admin) has no User row, so runs it triggers have
    // no createdBy (same convention as the test-budget service's null userId).
    createdBy: { type: ObjectId, ref: UserModel, default: null },
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
// Retention enforced by Mongo's own TTL monitor rather than a scheduled job —
// same mechanism as AISkillInvocation.expiresAt and translation-job.schema.js.
AIPlaygroundRunSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = AIPlaygroundRunSchema;
