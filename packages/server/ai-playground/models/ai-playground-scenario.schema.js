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
    // findApplicable now requires categories alongside scope (cf.
    // expertise.repository). Pre-filled in the UI with the scenario skill's
    // category; a filter is applied only when BOTH scope and categories are set.
    categories: { type: [String], default: [] },
    emailType: { type: String, default: null },
    language: { type: String, default: null },
  },
  { _id: false }
);

// Reserved for step 3 (benchmark mode) — NOT wired into invoke() in v1: the
// provider always comes from the Group's Skills-engine Integration, and no UI
// exposes these fields (deliberate: never show a control without effect).
// The runner passes the override through as a forward-compat envelope only.
// Cf. docs/REVIEW_GUIDE_AI_MODULES.md.
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
    description: { type: String, default: '', maxlength: 5000 },
    tags: { type: [String], default: [] },

    skillRef: { type: SkillRefSchema, required: true },

    expertiseRefs: { type: [ExpertiseRefSchema], default: [] },
    expertiseFilter: {
      type: ExpertiseFilterSchema,
      // The full shape, `categories` included. Mongoose would have filled it
      // anyway, but the filter's shape was described in four places and this
      // one disagreed with the other three.
      default: () => ({
        scope: [],
        categories: [],
        emailType: null,
        language: null,
      }),
    },

    input: { type: Mixed, default: {} },

    providerOverride: {
      type: ProviderOverrideSchema,
      default: () => ({}),
    },

    // Reserved for step 2 (Group selector) — no UI sets it in v1: the runner
    // falls back to the platform group. Cf. docs/REVIEW_GUIDE_AI_MODULES.md.
    groupContext: { type: ObjectId, ref: GroupModel, default: null },
    // Reserved for step 2 (DSE v2, prompt variants) — never populated in v1.
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
