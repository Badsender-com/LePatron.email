'use strict';

const { z } = require('zod');
const { McpFeedbacks } = require('../common/models.common.js');
const { resolveIdentity } = require('./mcp-identity.js');
const { readableExpertise } = require('./mcp-expertises.js');
const { servedSkill, versionOf } = require('./mcp-skill-catalog.js');
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
  return found ? { kind, id, version: versionOf(found.version) } : null;
}

/**
 * A feedback, and its retex (ADR 0012): the session summary the assistant
 * writes is kept only when the group allows retex and the user agreed to it
 * for this feedback. The answer says what was kept, since the user cannot see
 * LePatron's side.
 */
async function submitFeedback(args, ctx) {
  const authInfo = ctx.http?.authInfo;
  const identity = await resolveIdentity(authInfo);
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

  const summary = (args.sessionSummary || '').trim();
  const allowed =
    identity.group.allowRetex === true && args.consentToRetex === true;
  let retex = 'none';
  if (summary) retex = allowed ? 'kept' : 'dropped';

  await McpFeedbacks.create({
    _company: identity.group._id,
    _user: identity.user._id,
    clientId: authInfo.clientId || '',
    rating: args.rating,
    comment: args.comment || '',
    references,
    retex: retex === 'kept' ? summary : null,
    expiresAt: computeExpiresAt(new Date(), identity.group.logRetentionDays),
  });

  const answer = { recorded: true, retex };
  return {
    content: [{ type: 'text', text: JSON.stringify(answer) }],
    structuredContent: answer,
  };
}

// What one feedback holds at most: a few things it is about, and a comment
// and a summary a person reads.
const MAX_REFERENCES = 20;
const MAX_COMMENT = 4000;
const MAX_SUMMARY = 20000;

function registerSubmitFeedback(server) {
  server.registerTool(
    'submit_feedback',
    {
      title: 'Send feedback to Badsender',
      description:
        "Sends the user's feedback on what LePatron gave them: a thumbs up or down, a comment, and what it is about (skills, expertises, mailings). The comment is always kept: write what the user says of LePatron, never the content of their conversation. A summary of the session may be attached only if the user explicitly agrees to share it with Badsender (consentToRetex); ask them first. The answer says whether the summary was kept.",
      inputSchema: z.object({
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
                .max(200)
                .describe('Its skillId, expertiseId or mailingId.'),
            })
          )
          .max(MAX_REFERENCES)
          .optional()
          .describe(`What the feedback is about, ${MAX_REFERENCES} at most.`),
        consentToRetex: z
          .boolean()
          .optional()
          .describe(
            'true only if the user explicitly agreed to share a summary of the session with Badsender, for this feedback.'
          ),
        sessionSummary: z
          .string()
          .max(MAX_SUMMARY)
          .optional()
          .describe(
            "A summary of the session, kept only with consentToRetex and if the company allows it. Never the user's own content."
          ),
      }),
      outputSchema: z.object({
        recorded: z.boolean(),
        retex: z.enum(['none', 'kept', 'dropped']),
      }),
      annotations: ADDITIVE,
    },
    submitFeedback
  );
}

module.exports = { registerSubmitFeedback };
