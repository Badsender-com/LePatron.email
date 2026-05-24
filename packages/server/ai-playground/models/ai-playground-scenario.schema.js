'use strict';

const { Schema } = require('mongoose');
const { ObjectId, Mixed } = Schema.Types;
const {
  UserModel,
  GroupModel,
  IntegrationModel,
  AIPlaygroundRunModel,
} = require('../../constant/model.names.js');
const {
  ScenarioIdRegex,
  MaxScenarioIdLength,
  VersionRefModes,
  VersionRefModeValues,
} = require('../constant/playground-constants.js');

const SkillRefSchema = new Schema(
  {
    skillId: { type: String, required: true },
    mode: {
      type: String,
      enum: VersionRefModeValues,
      default: VersionRefModes.ACTIVE,
    },
    versionMajor: { type: Number },
    versionMinor: { type: Number },
  },
  { _id: false }
);

const ExpertiseRefSchema = new Schema(
  {
    expertiseId: { type: String, required: true },
    mode: {
      type: String,
      enum: VersionRefModeValues,
      default: VersionRefModes.ACTIVE,
    },
    versionMajor: { type: Number },
    versionMinor: { type: Number },
  },
  { _id: false }
);

const ExpertiseFilterSchema = new Schema(
  {
    scope: { type: [String], default: [] },
    emailType: { type: String, default: null },
    language: { type: String, default: null },
  },
  { _id: false }
);

const ProviderOverrideSchema = new Schema(
  {
    integrationId: { type: ObjectId, ref: IntegrationModel, default: null },
    model: { type: String, default: null },
    temperature: { type: Number },
    maxTokens: { type: Number },
    topP: { type: Number },
  },
  { _id: false }
);

const AIPlaygroundScenarioSchema = new Schema(
  {
    scenarioId: {
      type: String,
      required: true,
      unique: true,
      maxlength: MaxScenarioIdLength,
      match: [ScenarioIdRegex, 'scenarioId must match ^[a-z0-9._-]+$'],
    },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    tags: { type: [String], default: [] },

    skillRef: { type: SkillRefSchema, required: true },

    expertiseRefs: { type: [ExpertiseRefSchema], default: [] },
    expertiseFilter: {
      type: ExpertiseFilterSchema,
      default: () => ({ scope: [], emailType: null, language: null }),
    },

    input: { type: Mixed, default: {} },

    providerOverride: {
      type: ProviderOverrideSchema,
      default: () => ({}),
    },

    groupContext: { type: ObjectId, ref: GroupModel, default: null },
    variantPath: { type: [String], default: [] },

    goldenRunId: { type: ObjectId, ref: AIPlaygroundRunModel, default: null },

    owner: { type: ObjectId, ref: UserModel },
    updatedBy: { type: ObjectId, ref: UserModel },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

AIPlaygroundScenarioSchema.index({ 'skillRef.skillId': 1 });
AIPlaygroundScenarioSchema.index({ owner: 1 });
AIPlaygroundScenarioSchema.index({ tags: 1 });

/**
 * Light-weight pre-validate check:
 * - if skillRef.mode === 'pinned', versionMajor must be set (Mongo enforces required:false elsewhere).
 * - same for each expertiseRefs entry.
 * Full existence checks (skill/expertise must exist + ACTIVE) are deferred to
 * the service layer to avoid synchronous DB calls inside the schema hook.
 */
AIPlaygroundScenarioSchema.pre('validate', function preValidate(next) {
  if (
    this.skillRef &&
    this.skillRef.mode === VersionRefModes.PINNED &&
    (this.skillRef.versionMajor === undefined ||
      this.skillRef.versionMajor === null)
  ) {
    return next(
      new Error('skillRef.versionMajor is required when mode is "pinned"')
    );
  }
  for (const ref of this.expertiseRefs || []) {
    if (
      ref.mode === VersionRefModes.PINNED &&
      (ref.versionMajor === undefined || ref.versionMajor === null)
    ) {
      return next(
        new Error(
          `expertiseRefs entry for "${ref.expertiseId}" has mode=pinned but no versionMajor`
        )
      );
    }
  }
  next();
});

module.exports = AIPlaygroundScenarioSchema;
