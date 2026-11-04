'use strict';

/**
 * The format of a skills export (ADR 0018): what a file may hold, typed, and
 * how it is read.
 */

const createError = require('http-errors');
const { z } = require('zod');
const ERROR_CODES = require('../../constant/error-codes.js');
const {
  SkillNatureValues,
  SkillCategoryValues,
  SkillIdRegex,
  MaxConsumedExpertises,
  MaxSkillIdLength,
} = require('../constant/skill-constants.js');

const FORMAT = 1;

// What a file may hold, typed, so a wrong file is refused whole before the
// preview rather than failing item by item at the import (ADR 0018). Keys
// this format does not know are dropped: a field added to what a file
// carries changes FORMAT, so an older instance refuses the file rather than
// lose the field.
const id = z.string().max(MaxSkillIdLength).regex(SkillIdRegex);
const strings = z.array(z.string());
const version = (content) =>
  z.object({
    major: z.number().int().min(1),
    minor: z.number().int().min(0),
    changelog: z.string().optional(),
    releaseNotes: z.string().optional(),
    ...content,
  });
const TEST_CASE = z.object({
  name: z.string().min(1),
  input: z.unknown().refine((value) => value !== undefined && value !== null, {
    params: { reason: 'missing' },
  }),
  expectedOutput: z.unknown().optional(),
  notes: z.string().optional(),
});
const EXPERTISE = z.object({
  expertiseId: id,
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(SkillCategoryValues),
  scope: strings.optional(),
  isTransversal: z.boolean().optional(),
  appliesToEmailTypes: strings.optional(),
  appliesToLanguages: strings.optional(),
  version: version({
    body: z.string().optional(),
    examplesGood: strings.optional(),
    examplesBad: strings.optional(),
  }),
});
const SKILL = z.object({
  skillId: id,
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(SkillCategoryValues),
  version: version({
    // The version's, as every content of it (ADR 0013).
    nature: z.enum(SkillNatureValues),
    systemPrompt: z.string().optional(),
    skillBody: z.string().optional(),
    inputTemplate: z.string().optional(),
    inputSchemaId: z.string().optional(),
    outputSchemaId: z.string().optional(),
    modelHints: z
      .object({
        temperature: z.number().optional(),
        maxTokens: z.number().optional(),
        topP: z.number().optional(),
      })
      .optional(),
    testCases: z.array(TEST_CASE).optional(),
    procedure: z.string().optional(),
    // As the back office saves them: each named once, a bounded list.
    consumedExpertiseIds: z
      .array(id)
      .max(MaxConsumedExpertises)
      .refine((ids) => new Set(ids).size === ids.length, {
        params: { reason: 'duplicate' },
      })
      .optional(),
  }),
});
// An item twice would be previewed twice, and its second import would fail.
const once = (idField) => (items, ctx) => {
  const seen = new Set();
  items.forEach((item, index) => {
    if (seen.has(item[idField])) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [index, idField],
        params: { reason: 'duplicate' },
      });
    }
    seen.add(item[idField]);
  });
};
const FILE = z
  .object({
    format: z.literal(FORMAT),
    origin: z.string(),
    exportedAt: z.string(),
    exportedBy: z.string(),
    expertises: z.array(EXPERTISE).superRefine(once('expertiseId')),
    skills: z.array(SKILL).superRefine(once('skillId')),
  })
  .passthrough();

// Why a field is refused, as one of the few reasons the interface words,
// each its error code; a refusal none of them names is SKILLS_EXPORT_INVALID.
const REFUSALS = {
  missing: ERROR_CODES.SKILLS_EXPORT_FIELD_MISSING,
  wrong_type: ERROR_CODES.SKILLS_EXPORT_FIELD_WRONG_TYPE,
  not_allowed: ERROR_CODES.SKILLS_EXPORT_FIELD_NOT_ALLOWED,
  too_big: ERROR_CODES.SKILLS_EXPORT_FIELD_TOO_BIG,
  too_small: ERROR_CODES.SKILLS_EXPORT_FIELD_TOO_SMALL,
  duplicate: ERROR_CODES.SKILLS_EXPORT_FIELD_DUPLICATE,
};

const valueAt = (json, path) =>
  path.reduce((value, key) => (value == null ? undefined : value[key]), json);

function reasonOf(issue, json) {
  switch (issue.code) {
    case 'custom':
      return issue.params && issue.params.reason;
    case 'invalid_type':
      return valueAt(json, issue.path) == null ? 'missing' : 'wrong_type';
    case 'invalid_value':
    case 'invalid_format':
      return 'not_allowed';
    case 'too_big':
    case 'too_small':
      return issue.code;
    default:
      return undefined;
  }
}

/**
 * A skills export read from its JSON, or a 400 saying why it cannot be: an
 * unknown format (SKILLS_EXPORT_FORMAT_UNKNOWN), or a content that fails
 * validation (a SKILLS_EXPORT_FIELD_* code, or SKILLS_EXPORT_INVALID), with
 * the `field` refused. The whole file is refused, before anything is shown.
 */
function readSkillsExport(json) {
  if (!json || json.format !== FORMAT) {
    throw createError(400, ERROR_CODES.SKILLS_EXPORT_FORMAT_UNKNOWN, {
      format: String(json && json.format),
      expected: FORMAT,
    });
  }
  const parsed = FILE.safeParse(json);
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    const code =
      REFUSALS[reasonOf(issue, json)] || ERROR_CODES.SKILLS_EXPORT_INVALID;
    throw createError(400, code, { field: issue.path.join('.') });
  }
  return parsed.data;
}

// The content fields of a version a file carries, by kind: those of the
// models' versions (VERSION_CONTENT_FIELDS), which a test keeps equal.
const RELEASE_FIELDS = ['major', 'minor', 'changelog', 'releaseNotes'];
const versionFieldsOf = (schema) =>
  Object.keys(schema.shape.version.shape).filter(
    (field) => !RELEASE_FIELDS.includes(field)
  );
const VERSION_FIELDS = {
  expertise: versionFieldsOf(EXPERTISE),
  skill: versionFieldsOf(SKILL),
};

module.exports = {
  FORMAT,
  FILE,
  readSkillsExport,
  VERSION_FIELDS,
  // What a file holds of one item, for production's answer to a copy.
  ITEM_SCHEMAS: { expertise: EXPERTISE, skill: SKILL },
};
