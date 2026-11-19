'use strict';

const {
  STATUSES,
  STATUS_VALUES,
  SKILL_NATURES,
  SKILL_NATURE_VALUES,
  AUDIENCES,
  AUDIENCE_VALUES,
  MAX_CONSUMED_EXPERTISES,
} = require('../../../shared/ai-skill/constants.js');

const SkillCategories = Object.freeze({
  REDACTION: 'redaction',
  QC: 'qc',
  DESIGN: 'design',
  HTML_INTEGRATION: 'html_integration',
  DELIVERABILITY: 'deliverability',
  TRANSLATION: 'translation',
  OTHER: 'other',
});

const SkillCategoryValues = Object.values(SkillCategories);

// The statuses, the nature of a skill and the audience of a skill or an
// expertise (ADR 0013), with the back office
// (packages/shared/ai-skill/constants.js).
const SkillStatuses = STATUSES;
const SkillStatusValues = [...STATUS_VALUES];
const SkillNatures = SKILL_NATURES;
const SkillNatureValues = [...SKILL_NATURE_VALUES];
const Audiences = AUDIENCES;
const AudienceValues = [...AUDIENCE_VALUES];

const InvocationStatuses = Object.freeze({
  SUCCESS: 'SUCCESS',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  TIMEOUT: 'TIMEOUT',
  CANCELLED: 'CANCELLED',
  CONFIG_ERROR: 'CONFIG_ERROR',
});

const InvocationStatusValues = Object.values(InvocationStatuses);

// Default release notes of a minor version, written into the document at
// creation. French on purpose and by exception: this is editorial CONTENT
// stored next to the doctrine an author writes — the same French as the prompts
// and the expertise bodies — not a code message, a log or a UI label. An i18n
// key cannot be used: the value is persisted once and then displayed and edited
// as authored, with no locale at hand at creation time.
const MinorVersionDefaults = Object.freeze({
  changelog: 'Correction mineure',
  releaseNotes: 'Correction mineure sans changement de doctrine.',
});

const SkillIdRegex = /^[a-z0-9._-]+$/;
const SectionIdRegex = /^[a-z0-9-]+$/;
const MaxSkillIdLength = 100;
const MaxConsumedExpertises = MAX_CONSUMED_EXPERTISES;
const DefaultLogRetentionDays = 30;
// NB: the retention bounds (7/365 days) live as literals on
// Group.logRetentionDays (group.schema.js) — single source of truth there.

module.exports = {
  SkillCategoryValues,
  Audiences,
  AudienceValues,
  SkillNatures,
  SkillNatureValues,
  SkillStatuses,
  SkillStatusValues,
  InvocationStatuses,
  InvocationStatusValues,
  MinorVersionDefaults,
  SkillIdRegex,
  SectionIdRegex,
  MaxSkillIdLength,
  MaxConsumedExpertises,
  DefaultLogRetentionDays,
};
