'use strict';

// What the writing tools take and answer (ADR 0014), checked by the SDK
// before a handler runs: bounded, like every input of this server.

const { z } = require('zod');
const {
  SkillCategoryValues,
  SkillIdRegex,
  MaxConsumedExpertises,
} = require('../ai-skill/constant/skill-constants.js');

const MAX_ID_LENGTH = 100;
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_TEXT_LENGTH = 50000;
const MAX_EXAMPLES = 50;
const MAX_EXAMPLE_LENGTH = 2000;
const MAX_CHANGELOG_LENGTH = 2000;
const MAX_SCOPES = 20;
const MAX_SCOPE_LENGTH = 50;

const ID = z.string().min(1).max(MAX_ID_LENGTH);
const NEW_ID = ID.regex(SkillIdRegex);
const TITLE = z.string().min(1).max(MAX_TITLE_LENGTH);
const DESCRIPTION = z.string().max(MAX_DESCRIPTION_LENGTH);
const TEXT = z.string().max(MAX_TEXT_LENGTH);
const EXAMPLES = z.array(z.string().max(MAX_EXAMPLE_LENGTH)).max(MAX_EXAMPLES);
const CONSUMED = z
  .array(z.string().regex(SkillIdRegex).max(MAX_ID_LENGTH))
  .max(MaxConsumedExpertises);
const changelog = z
  .string()
  .min(1, 'A changelog is required')
  .max(MAX_CHANGELOG_LENGTH);

const ANSWER = z.object({
  expertiseId: z.string().optional(),
  skillId: z.string().optional(),
  version: z.string(),
  status: z.string(),
  audience: z.string().optional(),
});
const PROPOSE_EXPERTISE_INPUT = z.object({
  expertiseId: ID,
  body: TEXT.optional(),
  examplesGood: EXAMPLES.optional(),
  examplesBad: EXAMPLES.optional(),
  changelog,
  major: z.boolean().optional(),
});
const PROPOSE_SKILL_INPUT = z.object({
  skillId: ID,
  procedure: TEXT.optional(),
  consumedExpertiseIds: CONSUMED.optional(),
  systemPrompt: TEXT.optional(),
  skillBody: TEXT.optional(),
  inputTemplate: TEXT.optional(),
  changelog,
  major: z.boolean().optional(),
});
const CREATE_EXPERTISE_INPUT = z.object({
  expertiseId: NEW_ID,
  title: TITLE,
  category: z.enum(SkillCategoryValues),
  description: DESCRIPTION.optional(),
  scope: z.array(z.string().max(MAX_SCOPE_LENGTH)).max(MAX_SCOPES).optional(),
  isTransversal: z.boolean().optional(),
  body: TEXT,
  changelog,
});
const CREATE_TASK_SKILL_INPUT = z.object({
  skillId: NEW_ID,
  title: TITLE,
  category: z.enum(SkillCategoryValues),
  description: DESCRIPTION.optional(),
  procedure: TEXT,
  consumedExpertiseIds: CONSUMED.optional(),
  changelog,
});

module.exports = {
  ANSWER,
  PROPOSE_EXPERTISE_INPUT,
  PROPOSE_SKILL_INPUT,
  CREATE_EXPERTISE_INPUT,
  CREATE_TASK_SKILL_INPUT,
};
