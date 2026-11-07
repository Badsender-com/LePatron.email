'use strict';

const { z } = require('zod');
const { McpFeedbacks } = require('../common/models.common.js');
const { versionLabel } = require('../ai-skill/services/version-helpers.js');
const { withIdentity } = require('./mcp-identity.js');
const { readableExpertise } = require('./mcp-expertises.js');
const { servedSkill } = require('./mcp-skill-catalog.js');
const { readableMailing } = require('./mcp-mailing-read.js');
const { failure, ADDITIVE } = require('./mcp-tool-grammar.js');
const {
  computeExpiresAt,
} = require('../ai-skill/services/invocation-logger.service.js');

// What a reference points at, read as the user may read it, with the version
// it was given on; null when the user may not read it.
async function resolveReference({ kind, id }, identity) {
  if (kind === 'mailing') {
    return (await readableMailing(id, identity))
      ? { kind, id, version: null }
      : null;
  }
  // The version read: a draft's in drafts mode (#1385).
  const found =
    kind === 'skill'
      ? await servedSkill(id, identity.group, identity.drafts)
      : await readableExpertise(id, identity.group, identity.drafts);
  return found ? { kind, id, version: versionLabel(found.version) } : null;
}

/**
 * A feedback (ADR 0012): a rating and a comment on what LePatron gave. What
 * the work taught goes in a retex, apart (ADR 0021): a feedback no longer
 * carries a summary of the session.
 */
async function submitFeedback(identity, args, ctx) {
  const authInfo = ctx.http?.authInfo || {};
  const references = [];
  for (const reference of args.references || []) {
    // eslint-disable-next-line no-await-in-loop
    const resolved = await resolveReference(reference, identity);
    if (!resolved) {
      return failure(
        `Not found: the ${reference.kind} ${reference.id}, or this user may not read it.`
      );
    }
    references.push(resolved);
  }

  await McpFeedbacks.create({
    _company: identity.group._id,
    _user: identity.user._id,
    clientId: authInfo.clientId || '',
    rating: args.rating,
    comment: args.comment || '',
    references,
    expiresAt: computeExpiresAt(new Date(), identity.group.logRetentionDays),
  });

  const answer = { recorded: true };
  return {
    content: [{ type: 'text', text: JSON.stringify(answer) }],
    structuredContent: answer,
  };
}

// What one feedback holds at most: a few things it is about, and a comment
// a person reads.
const MAX_REFERENCES = 20;
const MAX_COMMENT = 4000;
const MAX_ID_LENGTH = 200;

const FEEDBACK_INPUT = z.object({
  rating: z
    .enum(['up', 'down'])
    .describe('up: the user is satisfied. down: they are not.'),
  comment: z
    .string()
    .max(MAX_COMMENT)
    .optional()
    .describe('What the user says of LePatron, in their words.'),
  references: z
    .array(
      z.object({
        kind: z
          .enum(['skill', 'expertise', 'mailing'])
          .describe('skill, expertise or mailing.'),
        id: z
          .string()
          .max(MAX_ID_LENGTH)
          .describe('Its skillId, expertiseId or mailingId.'),
      })
    )
    .max(MAX_REFERENCES)
    .optional()
    .describe(`What the feedback is about, ${MAX_REFERENCES} at most.`),
});
const FEEDBACK_OUTPUT = z.object({
  recorded: z.boolean(),
});

function registerSubmitFeedback(server) {
  server.registerTool(
    'submit_feedback',
    {
      title: 'Send feedback on LePatron',
      description:
        "Sends the user's feedback on what LePatron gave them: a thumbs up or down, a comment, and what it is about (skills, expertises, mailings). Write what the user says of LePatron, never the content of their conversation. What the work taught about a skill or an expertise is a retex: report_retex.",
      inputSchema: FEEDBACK_INPUT,
      outputSchema: FEEDBACK_OUTPUT,
      annotations: ADDITIVE,
    },
    withIdentity(submitFeedback)
  );
}

module.exports = { registerSubmitFeedback };
