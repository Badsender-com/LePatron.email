'use strict';

/**
 * The format of a skills export (ADR 0018): what a file may hold, typed, and
 * how it is read.
 */

const createError = require('http-errors');
const { z } = require('zod');
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
  input: z
    .unknown()
    .refine((value) => value !== undefined && value !== null, 'Required'),
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
      .refine(
        (ids) => new Set(ids).size === ids.length,
        'names an expertise twice'
      )
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
        message: `"${item[idField]}" is in the file twice`,
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

/**
 * A skills export read from its JSON, or a 400 saying why it cannot be: an
 * unknown format, or a content that fails validation. The whole file is
 * refused, before anything is shown.
 */
function readSkillsExport(json) {
  if (!json || json.format !== FORMAT) {
    throw createError(
      400,
      `Unknown skills export format: ${
        json && json.format
      }. This instance reads format ${FORMAT}.`
    );
  }
  const parsed = FILE.safeParse(json);
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    throw createError(
      400,
      `Invalid skills export: ${issue.path.join('.')} ${issue.message}`
    );
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

module.exports = { FORMAT, readSkillsExport, VERSION_FIELDS };
