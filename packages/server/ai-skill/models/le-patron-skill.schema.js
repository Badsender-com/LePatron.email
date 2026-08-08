'use strict';

const { Schema } = require('mongoose');
const { ObjectId, Mixed } = Schema.Types;
const { UserModel } = require('../../constant/model.names.js');
const { hasSchema } = require('../schemas');
const {
  SkillCategoryValues,
  SkillStatuses,
  SkillStatusValues,
  SkillIdRegex,
  MaxSkillIdLength,
} = require('../constant/skill-constants.js');

const INPUT_PLACEHOLDER_REGEX = /\{\{\s*input\b[^}]*\}\}/;

const TestCaseSchema = new Schema(
  {
    name: { type: String, required: true },
    input: { type: Mixed, required: true },
    expectedOutput: { type: Mixed },
    notes: { type: String },
  },
  { _id: false }
);

const ModelHintsSchema = new Schema(
  {
    temperature: { type: Number },
    maxTokens: { type: Number },
    topP: { type: Number },
  },
  { _id: false }
);

const VersionStatusValues = ['DRAFT', 'ACTIVE', 'ARCHIVED'];

const SkillVersionSchema = new Schema(
  {
    versionMajor: { type: Number, required: true, min: 1 },
    versionMinor: { type: Number, required: true, default: 0, min: 0 },
    status: {
      type: String,
      enum: VersionStatusValues,
      default: 'DRAFT',
    },
    systemPrompt: { type: String, default: '' },
    skillBody: { type: String, default: '' },
    inputTemplate: { type: String, default: '' },
    modelHints: { type: ModelHintsSchema, default: () => ({}) },
    changelog: { type: String, default: '' },
    releaseNotes: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: ObjectId, ref: UserModel },
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: ObjectId, ref: UserModel },
    activatedAt: { type: Date, default: null },
    testCases: { type: [TestCaseSchema], default: [] },
  },
  { _id: false }
);

const ActiveVersionSchema = new Schema(
  {
    major: { type: Number, default: null },
    minor: { type: Number, default: 0 },
  },
  { _id: false }
);

const LePatronSkillSchema = new Schema(
  {
    skillId: {
      type: String,
      required: [true, 'skillId is required'],
      unique: true,
      maxlength: MaxSkillIdLength,
      match: [SkillIdRegex, 'skillId must match ^[a-z0-9._-]+$'],
    },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    category: {
      type: String,
      enum: SkillCategoryValues,
      required: true,
    },
    inputSchemaId: { type: String, required: true },
    outputSchemaId: { type: String, required: true },
    owner: { type: ObjectId, ref: UserModel },
    status: {
      type: String,
      enum: SkillStatusValues,
      default: SkillStatuses.DRAFT,
    },
    activeVersion: {
      type: ActiveVersionSchema,
      default: () => ({ major: null, minor: 0 }),
    },
    versions: { type: [SkillVersionSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

LePatronSkillSchema.index({ category: 1 });
LePatronSkillSchema.index({ status: 1 });

/**
 * Validation hook:
 * - Ensure inputSchemaId / outputSchemaId exist in the zod registry.
 * - Ensure `{{input.*}}` placeholders never appear outside `inputTemplate`
 *   (prompt-injection guard — see PLAN §4.4).
 */
LePatronSkillSchema.pre('validate', function preValidate(next) {
  if (!hasSchema(this.inputSchemaId)) {
    return next(
      new Error(
        `Unknown inputSchemaId "${this.inputSchemaId}" (not in zod registry)`
      )
    );
  }
  if (!hasSchema(this.outputSchemaId)) {
    return next(
      new Error(
        `Unknown outputSchemaId "${this.outputSchemaId}" (not in zod registry)`
      )
    );
  }

  for (const version of this.versions || []) {
    const label = `${version.versionMajor}.${version.versionMinor}`;
    if (INPUT_PLACEHOLDER_REGEX.test(version.systemPrompt || '')) {
      return next(
        new Error(
          `Version ${label}: {{input.*}} placeholders are not allowed in systemPrompt`
        )
      );
    }
    if (INPUT_PLACEHOLDER_REGEX.test(version.skillBody || '')) {
      return next(
        new Error(
          `Version ${label}: {{input.*}} placeholders are not allowed in skillBody`
        )
      );
    }
  }
  next();
});

module.exports = LePatronSkillSchema;
module.exports.INPUT_PLACEHOLDER_REGEX = INPUT_PLACEHOLDER_REGEX;
