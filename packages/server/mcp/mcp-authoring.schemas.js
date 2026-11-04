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
  .max(MAX_CHANGELOG_LENGTH)
  .describe('What changes and why, in a sentence or two, in French.');

const ANSWER = z.object({
  expertiseId: z.string().optional(),
  skillId: z.string().optional(),
  version: z.string(),
  status: z.enum(['draft']),
  audience: z.string().optional(),
});
const major = z
  .boolean()
  .optional()
  .describe(
    'true for a major version (a change of meaning). Default: a minor one.'
  );
const newIdOf = (kind) =>
  NEW_ID.describe(
    `The ${kind} id: lower case letters, digits, dots, dashes and underscores, e.g. redaction.subject.length.`
  );
const categoryParam = z
  .enum(SkillCategoryValues)
  .describe(`One of: ${SkillCategoryValues.join(', ')}.`);
const expertiseIds = CONSUMED.optional().describe(
  `The expertiseIds the procedure reads, in the order it reads them, ${MaxConsumedExpertises} at most.`
);

const PROPOSE_EXPERTISE_INPUT = z.object({
  expertiseId: ID.describe(
    'The expertise to change, as find_applicable_expertises gives it.'
  ),
  body: TEXT.optional().describe(
    'The whole new text, in Markdown. Left out: unchanged.'
  ),
  examplesGood: EXAMPLES.optional().describe(
    'The whole new list of good examples. Left out: unchanged.'
  ),
  examplesBad: EXAMPLES.optional().describe(
    'The whole new list of bad examples. Left out: unchanged.'
  ),
  changelog,
  major,
});
const PROPOSE_SKILL_INPUT = z.object({
  skillId: ID.describe('The skill to change, as find_skills gives it.'),
  procedure: TEXT.optional().describe(
    'A task skill: the whole new procedure, in Markdown.'
  ),
  consumedExpertiseIds: expertiseIds,
  systemPrompt: TEXT.optional().describe(
    'A feature skill: the whole new instructions.'
  ),
  skillBody: TEXT.optional().describe('A feature skill: the whole new body.'),
  inputTemplate: TEXT.optional().describe(
    'A feature skill: the whole new input template.'
  ),
  changelog,
  major,
});
const CREATE_EXPERTISE_INPUT = z.object({
  expertiseId: newIdOf('expertise'),
  title: TITLE.describe('Its title, in French.'),
  category: categoryParam,
  description: DESCRIPTION.optional().describe(
    'What it covers, in a sentence, in French.'
  ),
  scope: z
    .array(z.string().max(MAX_SCOPE_LENGTH))
    .max(MAX_SCOPES)
    .optional()
    .describe(
      'The parts of the email it applies to, e.g. ["subject", "preheader"].'
    ),
  isTransversal: z
    .boolean()
    .optional()
    .describe('true if it applies to every part of the email.'),
  body: TEXT.describe('Its text, in Markdown, in French.'),
  changelog,
});
const CREATE_TASK_SKILL_INPUT = z.object({
  skillId: newIdOf('skill'),
  title: TITLE.describe('Its title, in French.'),
  category: categoryParam,
  description: DESCRIPTION.optional().describe(
    'When to use it, in a sentence, in French: find_skills matches on it.'
  ),
  procedure: TEXT.describe(
    'The procedure an assistant follows, in Markdown, in French.'
  ),
  consumedExpertiseIds: expertiseIds,
  changelog,
});

module.exports = {
  ANSWER,
  PROPOSE_EXPERTISE_INPUT,
  PROPOSE_SKILL_INPUT,
  CREATE_EXPERTISE_INPUT,
  CREATE_TASK_SKILL_INPUT,
};
