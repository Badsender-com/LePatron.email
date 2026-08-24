'use strict';

const { Schema } = require('mongoose');
const { ObjectId } = Schema.Types;
const { UserModel } = require('../../constant/model.names.js');
const { parseSections } = require('../services/expertise-parser.service.js');
const {
  SkillCategoryValues,
  SkillStatuses,
  SkillStatusValues,
  SkillIdRegex,
  MaxSkillIdLength,
} = require('../constant/skill-constants.js');

const SectionSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, default: '' },
    position: { type: Number, required: true },
  },
  { _id: false }
);

const VersionStatusValues = ['DRAFT', 'ACTIVE', 'ARCHIVED'];

const ExpertiseVersionSchema = new Schema(
  {
    versionMajor: { type: Number, required: true, min: 1 },
    versionMinor: { type: Number, required: true, default: 0, min: 0 },
    status: {
      type: String,
      enum: VersionStatusValues,
      default: 'DRAFT',
    },
    body: { type: String, default: '' },
    examplesGood: { type: [String], default: [] },
    examplesBad: { type: [String], default: [] },
    sections: { type: [SectionSchema], default: [] },
    changelog: { type: String, default: '' },
    releaseNotes: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: ObjectId, ref: UserModel },
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: ObjectId, ref: UserModel },
    activatedAt: { type: Date, default: null },
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

const ExpertiseSchema = new Schema(
  {
    expertiseId: {
      type: String,
      required: true,
      unique: true,
      maxlength: MaxSkillIdLength,
      match: [SkillIdRegex, 'expertiseId must match ^[a-z0-9._-]+$'],
    },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    category: {
      type: String,
      enum: SkillCategoryValues,
      required: true,
    },
    scope: { type: [String], default: [] },
    // Transversal expertise is loaded whatever the requested scope (e.g. a
    // brand voice), but stays filtered by categories / emailType / language —
    // "transversal" crosses PERIMETERS, never categories. An empty scope that
    // is NOT transversal matches no filtered query (cf. findApplicable):
    // forgetting to set a scope becomes visible instead of silently global.
    // The backend tolerates scope + isTransversal coexisting; the flag wins
    // over the scope (the UI disables/clears scope when it is checked).
    isTransversal: { type: Boolean, default: false },
    appliesToEmailTypes: { type: [String], default: [] },
    appliesToLanguages: { type: [String], default: [] },
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
    versions: { type: [ExpertiseVersionSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

ExpertiseSchema.index({ category: 1 });
ExpertiseSchema.index({ scope: 1 });
// findApplicable reads this on every filtered query (scope OR isTransversal).
ExpertiseSchema.index({ isTransversal: 1 });
ExpertiseSchema.index({ appliesToEmailTypes: 1 });
ExpertiseSchema.index({ status: 1 });

/**
 * Auto-derive the `sections[]` index from the Markdown body on each save.
 * Hard errors (invalid slug, duplicates) abort the save.
 */
ExpertiseSchema.pre('validate', function preValidate(next) {
  for (const version of this.versions || []) {
    const label = `${version.versionMajor}.${version.versionMinor}`;
    const { sections, errors } = parseSections(version.body || '');
    if (errors.length > 0) {
      return next(
        new Error(`Expertise version ${label}: ${errors.join('; ')}`)
      );
    }
    version.sections = sections;
  }
  next();
});

module.exports = ExpertiseSchema;
