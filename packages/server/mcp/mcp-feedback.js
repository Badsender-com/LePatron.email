'use strict';

const { z } = require('zod');
const { McpFeedbacks } = require('../common/models.common.js');
const { versionLabel } = require('../ai-skill/services/version-helpers.js');
const { withIdentity } = require('./mcp-identity.js');
const { readableExpertise } = require('./mcp-expertises.js');
const { servedSkill } = require('./mcp-skill-catalog.js');
const { readableMailing } = require('./mcp-mailings.js');
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

const failure = (text) => ({
  isError: true,
  content: [{ type: 'text', text }],
});

/**
 * A feedback, and its retex (ADR 0012): the session summary the assistant
 * writes is kept only when the company allows retex and the user agreed to it
 * for this feedback. The answer says what was kept, since the user cannot see
 * LePatron's side.
 */
async function submitFeedback(identity, args, ctx) {
  const authInfo = ctx.http?.authInfo || {};
  const references = [];
  for (const reference of args.references || []) {
    // eslint-disable-next-line no-await-in-loop
    const resolved = await resolveReference(reference, identity);
    if (!resolved) {
      return failure(`Not found: the ${reference.kind} ${reference.id}`);
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
const MAX_ID_LENGTH = 200;

const FEEDBACK_INPUT = z.object({
  rating: z.enum(['up', 'down']),
  comment: z.string().max(MAX_COMMENT).optional(),
  references: z
    .array(
      z.object({
        kind: z.enum(['skill', 'expertise', 'mailing']),
        id: z.string().max(MAX_ID_LENGTH),
      })
    )
    .max(MAX_REFERENCES)
    .optional(),
  consentToRetex: z.boolean().optional(),
  sessionSummary: z.string().max(MAX_SUMMARY).optional(),
});
const FEEDBACK_OUTPUT = z.object({
  recorded: z.boolean(),
  retex: z.enum(['none', 'kept', 'dropped']),
});

function registerSubmitFeedback(server) {
  server.registerTool(
    'submit_feedback',
    {
      title: 'Send feedback on LePatron',
      description:
        "Sends the user's feedback on what LePatron gave them: a thumbs up or down, a comment, and what it is about (skills, expertises, mailings). The comment is always kept: write what the user says of LePatron, never the content of their conversation. A summary of the session may be attached only if the user explicitly agrees to share it with the platform company (consentToRetex); ask them first. The answer says whether the summary was kept.",
      inputSchema: FEEDBACK_INPUT,
      outputSchema: FEEDBACK_OUTPUT,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    withIdentity(submitFeedback)
  );
}

module.exports = { registerSubmitFeedback };
