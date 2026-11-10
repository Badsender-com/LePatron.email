'use strict';

// What publish_draft and read_publication_check take and answer (ADR 0019).

const { z } = require('zod');
const { ID } = require('./mcp-authoring.schemas.js');

// What an assistant may send: bounded, like every input of this server.
const MAX_KEY_LENGTH = 4000;
const MAX_TEXT_LENGTH = 2000;
const MAX_GUARD_ID_LENGTH = 100;
const GUARD_ID = z
  .string()
  .max(MAX_GUARD_ID_LENGTH)
  .describe('The guardId publish_draft answered when it started the check.');

const TARGET = {
  kind: z.enum(['skill', 'expertise']).describe('One of: skill, expertise.'),
  id: ID.describe(
    'The skillId or expertiseId, as find_skills or find_applicable_expertises gives it.'
  ),
};

const PUBLISH_INPUT = z.object({
  ...TARGET,
  confirmation: z
    .string()
    .max(MAX_KEY_LENGTH)
    .optional()
    .describe(
      'The key the finished check answered. Leave it out to start the check; give it back to publish.'
    ),
  changelog: z
    .string()
    .max(MAX_TEXT_LENGTH)
    .optional()
    .describe(
      "What changes and why, in French. Default: the draft's own changelog. A major version needs one. Give the same at both calls."
    ),
  releaseNotes: z
    .string()
    .max(MAX_TEXT_LENGTH)
    .optional()
    .describe(
      "What users of the features will notice, in French. Default: the draft's own notes. A major version needs them. Give the same at both calls."
    ),
});

const CHECK_INPUT = z.object({ guardId: GUARD_ID });

const WARNINGS = z
  .array(
    z.object({
      code: z.string(),
      expertiseIds: z.array(z.string()).optional(),
    })
  )
  .describe(
    "What the publication warns of, without stopping it: a task skill's consumed expertises that are not published, or kept to the platform company while the skill is open to every company. Tell the user."
  );

const ANSWER = z.object({
  id: z.string(),
  version: z.string(),
  published: z.boolean(),
  status: z
    .string()
    .optional()
    .describe(
      'Of the check: running (read it again later), or done (show it, then confirm).'
    ),
  guardId: z
    .string()
    .optional()
    .describe('The check, to read again with read_publication_check.'),
  guard: z
    .object({})
    .passthrough()
    .describe(
      'Of the check: the features that use it, the AI calls it makes, and once done each test case before and after and the feature skills without a case. Once published, the counts recorded.'
    ),
  confirmation: z
    .string()
    .optional()
    .describe(
      'Once the check is done: the key to give back to publish this exact draft, within an hour.'
    ),
  next: z.string().optional().describe('What to do next.'),
  warnings: WARNINGS.optional(),
});

module.exports = { ANSWER, CHECK_INPUT, PUBLISH_INPUT };
