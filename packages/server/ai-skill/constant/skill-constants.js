'use strict';

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

const SkillStatuses = Object.freeze({
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
});

const SkillStatusValues = Object.values(SkillStatuses);

const InvocationStatuses = Object.freeze({
  SUCCESS: 'SUCCESS',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  TIMEOUT: 'TIMEOUT',
  CANCELLED: 'CANCELLED',
  CONFIG_ERROR: 'CONFIG_ERROR',
});

const InvocationStatusValues = Object.values(InvocationStatuses);

const SkillIdRegex = /^[a-z0-9._-]+$/;
const SectionIdRegex = /^[a-z0-9-]+$/;
const MaxSkillIdLength = 100;
const MaxDailyTestInvocations = 50;
const DefaultLogRetentionDays = 30;
const MinLogRetentionDays = 7;
const MaxLogRetentionDays = 365;

module.exports = {
  SkillCategories,
  SkillCategoryValues,
  SkillStatuses,
  SkillStatusValues,
  InvocationStatuses,
  InvocationStatusValues,
  SkillIdRegex,
  SectionIdRegex,
  MaxSkillIdLength,
  MaxDailyTestInvocations,
  DefaultLogRetentionDays,
  MinLogRetentionDays,
  MaxLogRetentionDays,
};
