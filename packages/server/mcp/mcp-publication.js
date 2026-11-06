'use strict';

// Publishing a draft from an assistant (ADR 0019, amending ADR 0014): two
// calls. The first runs the publication guard and publishes nothing; it
// answers the before and after and a confirmation key bound to the draft it
// checked, to the person and to an hour. The second publishes with that key,
// only if the draft is still the one checked. The key is signed, so nothing
// is held between the two calls.

const crypto = require('crypto');
const { z } = require('zod');
const createError = require('http-errors');
const config = require('../node.config.js');
const expertiseService = require('../ai-skill/services/expertise.service.js');
const skillService = require('../ai-skill/services/skill.service.js');
const publication = require('../ai-skill/services/skills-publication.service.js');
const {
  openDraftOf,
  versionLabel: label,
} = require('../ai-skill/services/version-helpers.js');
const { withIdentity } = require('./mcp-identity.js');
const { mayDraft, isRefusal } = require('./mcp-authoring.js');
const { failure, OVERWRITING } = require('./mcp-tool-grammar.js');

// What an assistant may send: bounded, like every input of this server.
const MAX_ID_LENGTH = 100;
const MAX_KEY_LENGTH = 4000;
const MAX_TEXT_LENGTH = 2000;

const KEY_LIFETIME_MS = 60 * 60 * 1000;

const getters = {
  skill: (id) => skillService.getSkill(id),
  expertise: (id) => expertiseService.getExpertise(id),
};

const success = (answer) => ({
  content: [{ type: 'text', text: JSON.stringify(answer) }],
  structuredContent: answer,
});

const plain = (doc) =>
  doc && typeof doc.toObject === 'function' ? doc.toObject() : doc;

// What the draft holds, as a fingerprint: any change to it changes the key.
function fingerprintOf(draft) {
  const { guardHistory: _history, ...content } = plain(draft);
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(content))
    .digest('base64url');
}

const sign = (payload) =>
  crypto
    .createHmac('sha256', config.sessionSecret)
    .update(`mcp-publish:${payload}`)
    .digest('base64url');

function keyOf(claims) {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

// The claims of a key this server signed, or null.
function claimsOf(key) {
  const [payload, signature] = String(key || '').split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (
    expected.length !== given.length ||
    !crypto.timingSafeEqual(expected, given)
  ) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch (err) {
    return null;
  }
}

// The guard's outcome, as the key carries it to the second call.
const failedIn = (guard) =>
  guard.cases.filter(
    (c) =>
      !c.after || c.after.error || (c.contract && c.contract.after === false)
  ).length;
const summaryOf = (guard) => ({
  cases: guard.cases.length,
  failed: failedIn(guard),
  missing: guard.missing || [],
});

async function draftFor(kind, id) {
  const doc = await getters[kind](id);
  const draft = openDraftOf(doc);
  if (!draft) {
    throw createError(
      409,
      `"${id}" has no draft to publish: write one first, or it is already published.`
    );
  }
  return {
    doc,
    draft,
    version: { major: draft.versionMajor, minor: draft.versionMinor },
  };
}

async function checkFirst({ kind, id }, user) {
  const { doc, draft, version } = await draftFor(kind, id);
  const guard = await publication.guardPublication({ kind, id, version });
  // What publishing it would warn of, told before the person agrees.
  const warnings = await publication.consumedWarningsOf(
    { kind, id, version },
    doc
  );
  const confirmation = keyOf({
    kind,
    id,
    version: label(draft),
    draft: fingerprintOf(draft),
    by: String(user.id),
    at: Date.now(),
    guard: summaryOf(guard),
  });
  return {
    id,
    version: label(draft),
    published: false,
    guard,
    warnings,
    confirmation,
  };
}

function assertKey(claims, { kind, id }, user, draft) {
  if (
    !claims ||
    claims.kind !== kind ||
    claims.id !== id ||
    claims.by !== String(user.id)
  ) {
    throw createError(
      400,
      'This confirmation key was not given for this draft: call publish_draft without one to check it first.'
    );
  }
  if (Date.now() - claims.at > KEY_LIFETIME_MS) {
    throw createError(
      409,
      'This confirmation key has expired: call publish_draft without one to check the draft again.'
    );
  }
  if (
    claims.version !== label(draft) ||
    claims.draft !== fingerprintOf(draft)
  ) {
    throw createError(
      409,
      'The draft changed after it was checked: call publish_draft without a confirmation to check it again.'
    );
  }
}

async function publishChecked(args, user, application) {
  const { kind, id, confirmation } = args;
  const { draft, version } = await draftFor(kind, id);
  const claims = claimsOf(confirmation);
  assertKey(claims, { kind, id }, user, draft);
  // A major needs a changelog and release notes: the draft's, unless the
  // assistant gives them.
  const fallback = `Publiée depuis un assistant (${application || 'MCP'}).`;
  const changelog = args.changelog || draft.changelog || fallback;
  const { doc, warnings } = await publication.publishVersion(
    {
      kind,
      id,
      version,
      guard: { summary: claims.guard },
      application,
      payload: {
        changelog,
        releaseNotes: args.releaseNotes || draft.releaseNotes || changelog,
      },
    },
    user
  );
  return {
    id,
    version: label(draft),
    published: true,
    guard: claims.guard,
    // What a publication warns of, as on the item's page (ADR 0013).
    warnings: [
      ...warnings,
      ...(await publication.consumedWarningsOf({ kind, id, version }, doc)),
    ],
  };
}

const PUBLISH_ANSWER = z.object({
  id: z.string(),
  version: z.string(),
  published: z.boolean(),
  guard: z
    .object({})
    .passthrough()
    .describe(
      'At the first call, the replay: the features that use it, each test case before and after, the feature skills without a case. At the second, the counts recorded.'
    ),
  warnings: z
    .array(
      z.object({
        code: z.string(),
        expertiseIds: z.array(z.string()).optional(),
      })
    )
    .describe(
      "What the publication warns of, without stopping it: a task skill's consumed expertises that are not published, or kept to the platform company while the skill is open to every company. Tell the user."
    ),
  confirmation: z
    .string()
    .optional()
    .describe(
      'At the first call: the key to give back to publish this exact draft, within an hour.'
    ),
});

const PUBLISH_INPUT = z.object({
  kind: z.enum(['skill', 'expertise']).describe('One of: skill, expertise.'),
  id: z
    .string()
    .min(1)
    .max(MAX_ID_LENGTH)
    .describe(
      'The skillId or expertiseId, as find_skills or find_applicable_expertises gives it.'
    ),
  confirmation: z
    .string()
    .max(MAX_KEY_LENGTH)
    .optional()
    .describe(
      'The key the first call answered. Leave it out to check the draft; give it back to publish.'
    ),
  changelog: z
    .string()
    .max(MAX_TEXT_LENGTH)
    .optional()
    .describe(
      "What changes and why, in French. Default: the draft's own changelog."
    ),
  releaseNotes: z
    .string()
    .max(MAX_TEXT_LENGTH)
    .optional()
    .describe(
      "What users of the features will notice, in French. Default: the draft's own notes."
    ),
});

const PUBLISHING_REFUSED =
  'Not allowed: publishing skills and expertises needs the skills:write scope and the right to manage the platform.';

// Who calls is checked first (`withIdentity`), then whether they may still
// publish; what the services refuse is answered, anything else is logged.
async function publishDraft({ user }, args, ctx) {
  const authInfo = ctx?.http?.authInfo;
  if (!mayDraft(user, authInfo)) return failure(PUBLISHING_REFUSED);
  try {
    const answer = args.confirmation
      ? await publishChecked(args, user, authInfo?.clientId)
      : await checkFirst(args, user);
    return success(answer);
  } catch (err) {
    if (isRefusal(err)) return failure(err.message);
    throw err;
  }
}

function registerPublicationTools(server) {
  server.registerTool(
    'publish_draft',
    {
      title: 'Publish a draft',
      description:
        'Publishes the open draft of a skill or an expertise, in two calls. Without a confirmation, it runs the publication guard and publishes nothing: show the user each test case before and after, and what the publication warns of, then call again with the confirmation key only once they agree. A difference warns, it never blocks. Publishing changes what LePatron features read at once; it does not open the version to every company (set_audience does).',
      inputSchema: PUBLISH_INPUT,
      outputSchema: PUBLISH_ANSWER,
      annotations: OVERWRITING,
    },
    withIdentity(publishDraft)
  );
}

module.exports = { registerPublicationTools };
