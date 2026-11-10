'use strict';

// What the writing tools take and answer (ADR 0014), checked by the SDK
// before a handler runs: bounded, like every input of this server.

const { z } = require('zod');
const {
  AudienceValues,
  SkillCategoryValues,
  SkillIdRegex,
  MaxConsumedExpertises,
} = require('../ai-skill/constant/skill-constants.js');
const { MAX_KEY_LENGTH } = require('./mcp-confirmation.js');

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

// Opening or closing a skill or an expertise (ADR 0019).
const SET_AUDIENCE_INPUT = z.object({
  kind: z.enum(['skill', 'expertise']).describe('One of: skill, expertise.'),
  id: ID.describe(
    'The skillId or expertiseId, as find_skills or find_applicable_expertises gives it.'
  ),
  audience: z
    .enum(AudienceValues)
    .describe(
      'all: every company, in the editor and in the assistants of those with MCP access; platform: the platform company only.'
    ),
  openExpertiseIds: CONSUMED.optional().describe(
    'Opening a task skill only: the expertises it consumes that are kept to the platform company, as platformOnlyExpertises listed them, to open to every company with it. Opening an expertise also applies it, at once, to the editor features of every company: ask the user for each one.'
  ),
  confirmation: z
    .string()
    .max(MAX_KEY_LENGTH)
    .optional()
    .describe(
      'The key the first call answered. Leave it out to check the change; give it back, with the same arguments, to apply it.'
    ),
});
const AUDIENCE_ANSWER = z.object({
  id: z.string(),
  audience: z.enum(AudienceValues),
  clientsRead: z
    .string()
    .nullable()
    .describe('The version clients read, null when none was published.'),
  changed: z
    .boolean()
    .describe(
      'Whether this call changed the audience: false at the check, and when the audience already was the one asked, at either call.'
    ),
  keptOnCopy: z
    .boolean()
    .optional()
    .describe(
      'On a copy of production (staging, development): the item is kept on the copy, so the next follow of production does not undo the change.'
    ),
  platformOnlyExpertises: z
    .array(z.object({ expertiseId: z.string(), title: z.string() }))
    .optional()
    .describe(
      'A task skill opened: the expertises it consumes still kept to the platform company, which the assistants of the other companies follow it without.'
    ),
  openTaskSkills: z
    .array(z.object({ skillId: z.string(), title: z.string() }))
    .optional()
    .describe(
      'An expertise kept to the platform company again: the task skills open to every company that consume it, and no longer receive it at the clients.'
    ),
  warnings: z
    .array(
      z.object({
        code: z.string(),
        expertiseIds: z.array(z.string()).optional(),
      })
    )
    .describe('What the change could not do or check, if anything.'),
  confirmation: z
    .string()
    .optional()
    .describe(
      'At the first call: the key to give back to apply this exact change, within an hour.'
    ),
});

module.exports = {
  ANSWER,
  PROPOSE_EXPERTISE_INPUT,
  PROPOSE_SKILL_INPUT,
  CREATE_EXPERTISE_INPUT,
  CREATE_TASK_SKILL_INPUT,
  SET_AUDIENCE_INPUT,
  AUDIENCE_ANSWER,
};
