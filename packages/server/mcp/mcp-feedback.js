'use strict';

const { z } = require('zod');
const { McpFeedbacks } = require('../common/models.common.js');
const { resolveIdentity } = require('./mcp-identity.js');
const { readableExpertise } = require('./mcp-expertises.js');
const { servedSkill, versionOf } = require('./mcp-skill-catalog.js');
const { readableMailing } = require('./mcp-mailings.js');

const MS_PER_DAY = 24 * 3600 * 1000;
const DEFAULT_RETENTION_DAYS = 30;

// What a reference points at, read as the user may read it, with the version
// it was given on; null when the user may not read it.
async function resolveReference({ kind, id }, identity) {
  if (kind === 'mailing') {
    return (await readableMailing(id, identity))
      ? { kind, id, version: null }
      : null;
  }
  const found =
    kind === 'skill'
      ? await servedSkill(id, identity.group)
      : await readableExpertise(id, identity.group);
  return found ? { kind, id, version: versionOf(found.version) } : null;
}

const failure = (text) => ({
  isError: true,
  content: [{ type: 'text', text }],
});

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
      return failure(`Not found: the ${reference.kind} ${reference.id}`);
    }
    references.push(resolved);
  }

  const summary = (args.sessionSummary || '').trim();
  const allowed =
    identity.group.allowRetex === true && args.consentToRetex === true;
  let retex = 'none';
  if (summary) retex = allowed ? 'kept' : 'dropped';

  const days = identity.group.logRetentionDays || DEFAULT_RETENTION_DAYS;
  await McpFeedbacks.create({
    _company: identity.group._id,
    _user: identity.user._id,
    clientId: authInfo.clientId || '',
    rating: args.rating,
    comment: args.comment || '',
    references,
    retex: retex === 'kept' ? summary : null,
    expiresAt: new Date(Date.now() + days * MS_PER_DAY),
  });

  const answer = { recorded: true, retex };
  return {
    content: [{ type: 'text', text: JSON.stringify(answer) }],
    structuredContent: answer,
  };
}

function registerSubmitFeedback(server) {
  server.registerTool(
    'submit_feedback',
    {
      title: 'Send feedback to Badsender',
      description:
        "Sends the user's feedback on what LePatron gave them: a thumbs up or down, a comment, and what it is about (skills, expertises, mailings). A summary of the session may be attached only if the user explicitly agrees to share it with Badsender (consentToRetex); ask them first. The answer says whether the summary was kept.",
      inputSchema: z.object({
        rating: z.enum(['up', 'down']),
        comment: z.string().optional(),
        references: z
          .array(
            z.object({
              kind: z.enum(['skill', 'expertise', 'mailing']),
              id: z.string(),
            })
          )
          .optional(),
        consentToRetex: z.boolean().optional(),
        sessionSummary: z.string().optional(),
      }),
      outputSchema: z.object({
        recorded: z.boolean(),
        retex: z.enum(['none', 'kept', 'dropped']),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    submitFeedback
  );
}

module.exports = { registerSubmitFeedback };
