'use strict';

const { z } = require('zod');
const { McpFeedbacks, Groups } = require('../common/models.common.js');
const {
  forgetRetex,
  MAX_COMMENT_WITHOUT_RETEX,
} = require('./mcp-access-option.js');
const { versionLabel } = require('../ai-skill/services/version-helpers.js');
const { withIdentity, success, failure } = require('./mcp-identity.js');
const { ADDITIVE } = require('./mcp-tool-grammar.js');
const { namedExpertises } = require('./mcp-expertises.js');
const { namedSkills } = require('./mcp-skill-catalog.js');
const { bareMailingId } = require('./mcp-mailings.js');
const {
  findReadableMailings,
} = require('../mailing/mailing-search.service.js');
const { computeExpiresAt } = require('../group/log-retention.js');

const keyOf = ({ kind, id }) => `${kind}:${id}`;

// A mailing is referred to by its id from list_mailings, or by the one search
// gives it: both name the same mailing.
const asReferred = (reference) =>
  reference.kind === 'mailing'
    ? { ...reference, id: bareMailingId(reference.id) }
    : reference;

async function stillAllowsRetex(groupId) {
  const group = await Groups.findById(groupId).select('allowRetex').lean();
  return Boolean(group && group.allowRetex === true);
}

// What each kind of reference is read with, as the user may read it, by name
// only: the version a skill or an expertise was given on (a draft's in drafts
// mode, #1385), none for a mailing, whose content is never read to check a
// right.
const READERS = {
  skill: async (ids, { group, drafts }) =>
    (await namedSkills(ids, group, drafts)).map(({ doc, version }) => [
      doc.skillId,
      versionLabel(version),
    ]),
  expertise: async (ids, { group, drafts }) =>
    (await namedExpertises(ids, group, drafts)).map(({ doc, version }) => [
      doc.expertiseId,
      versionLabel(version),
    ]),
  mailing: async (ids, { user }) =>
    (await findReadableMailings(user, ids)).map((m) => [String(m._id), null]),
};

/**
 * The references of a feedback, each once, read by kind in one query each.
 *
 * @returns {Promise<{ references?: Object[], missing?: Object }>} the
 *   references with their version, or the first one the user may not read
 */
async function resolveReferences(references, identity) {
  const unique = [
    ...new Map(references.map(asReferred).map((r) => [keyOf(r), r])).values(),
  ];
  const found = new Map();
  await Promise.all(
    Object.entries(READERS).map(async ([kind, read]) => {
      const ids = unique.filter((r) => r.kind === kind).map((r) => r.id);
      if (!ids.length) return;
      (await read(ids, identity)).forEach(([id, version]) =>
        found.set(keyOf({ kind, id }), version)
      );
    })
  );
  const missing = unique.find((r) => !found.has(keyOf(r)));
  if (missing) return { missing };
  return {
    references: unique.map(({ kind, id }) => ({
      kind,
      id,
      version: found.get(keyOf({ kind, id })),
    })),
  };
}

/**
 * A feedback, and its retex (ADR 0012): the session summary the assistant
 * writes is kept only when the company allows retex and the user agreed to it
 * for this feedback. The answer says what was kept, since the user cannot see
 * LePatron's side.
 */
async function submitFeedback(identity, args, ctx) {
  const authInfo = ctx.http?.authInfo || {};
  const { references, missing } = await resolveReferences(
    args.references || [],
    identity
  );
  if (missing) {
    return failure(
      `Not found: the ${missing.kind} ${missing.id}, or this user may not read it.`
    );
  }

  const summary = (args.sessionSummary || '').trim();
  const allowed =
    identity.group.allowRetex === true && args.consentToRetex === true;
  // The comment reaches the platform company whatever the retex: without it,
  // it stays a short word on LePatron, never room for a session summary.
  const comment = args.comment || '';
  if (!allowed && comment.length > MAX_COMMENT_WITHOUT_RETEX) {
    return failure(
      `The comment is limited to ${MAX_COMMENT_WITHOUT_RETEX} characters when no session summary may be shared (the user's consent and the company's): say in a few words what the user thinks of LePatron.`
    );
  }
  let retex = 'none';
  if (summary) retex = allowed ? 'kept' : 'dropped';

  const feedback = await McpFeedbacks.create({
    _company: identity.group._id,
    _user: identity.user._id,
    clientId: authInfo.clientId || '',
    rating: args.rating,
    comment,
    references,
    retex: retex === 'kept' ? summary : null,
    expiresAt: computeExpiresAt(new Date(), identity.group.logRetentionDays),
  });

  // The company may have stopped the retex while this feedback was written:
  // what it let the feedback keep is then forgotten, as for the others.
  const keptByRetex =
    retex === 'kept' || comment.length > MAX_COMMENT_WITHOUT_RETEX;
  if (keptByRetex && !(await stillAllowsRetex(identity.group._id))) {
    await forgetRetex(identity.group._id, { _id: feedback._id });
    if (retex === 'kept') retex = 'dropped';
  }

  return success({ recorded: true, retex });
}

// What one feedback holds at most: a few things it is about, and a comment
// and a summary a person reads. The comment is short unless the retex is
// granted, by the company and by the user (ADR 0012).
const MAX_REFERENCES = 20;
const MAX_COMMENT = 4000;
const MAX_SUMMARY = 20000;
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
          .describe(
            "A skill's skillId, an expertise's expertiseId, or a mailing's id, as list_mailings or search gives it (mailing:…)."
          ),
      })
    )
    .max(MAX_REFERENCES)
    .optional()
    .describe(`What the feedback is about, ${MAX_REFERENCES} at most.`),
  consentToRetex: z
    .boolean()
    .optional()
    .describe(
      'true only if the user explicitly agreed to share a summary of the session with the platform company, for this feedback.'
    ),
  sessionSummary: z
    .string()
    .max(MAX_SUMMARY)
    .optional()
    .describe(
      "A summary of the session, kept only with consentToRetex and if the company allows it. Never the user's own content."
    ),
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
      description: `Sends the user's feedback on what LePatron gave them: a thumbs up or down, a comment, and what it is about (skills, expertises, mailings). The rating and the comment are always shared with the platform company: write what the user says of LePatron, never the content of their conversation, in ${MAX_COMMENT_WITHOUT_RETEX} characters at most, or ${MAX_COMMENT} when a session summary may be shared. A summary of the session may be attached only if the user explicitly agrees to share it with the platform company (consentToRetex); ask them first. It is kept only if their company allows it too. The answer says whether the summary was kept.`,
      inputSchema: FEEDBACK_INPUT,
      outputSchema: FEEDBACK_OUTPUT,
      annotations: ADDITIVE,
    },
    withIdentity(submitFeedback)
  );
}

module.exports = { registerSubmitFeedback };
