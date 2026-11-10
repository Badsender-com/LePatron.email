'use strict';

// Publishing a draft from an assistant (ADR 0019, amending ADR 0014), in two
// steps. The first starts the publication guard on the server and publishes
// nothing; the check is read again until it is done, with the before and
// after and its key (guard-key.js), bound to the draft as it was, to the
// person, to an hour, and to the changelog and release notes asked for. The
// second publishes on that key, through the back office's own publication.

const crypto = require('crypto');
const createError = require('http-errors');
const expertiseService = require('../ai-skill/services/expertise.service.js');
const skillService = require('../ai-skill/services/skill.service.js');
const publication = require('../ai-skill/services/skills-publication.service.js');
const guardRuns = require('../ai-skill/services/guard-runs.js');
const { readGuardKey, isoOf } = require('../ai-skill/services/guard-key.js');
const {
  openDraftOf,
  versionLabel: label,
} = require('../ai-skill/services/version-helpers.js');
const {
  withIdentity,
  mayWrite,
  isRefusal,
  failure,
  refused,
  success,
} = require('./mcp-identity.js');
const {
  ANSWER,
  CHECK_INPUT,
  PUBLISH_INPUT,
} = require('./mcp-publication.schemas.js');
const { OVERWRITING, READ_ONLY } = require('./mcp-tool-grammar.js');

const getters = {
  skill: (id) => skillService.getSkill(id),
  expertise: (id) => expertiseService.getExpertise(id),
};

const KEY_REFUSED =
  'This confirmation key is not valid for this draft, or has expired: call publish_draft without one to check the draft again.';
const DRAFT_CHANGED =
  'The draft changed after it was checked: call publish_draft without a confirmation to check it again.';
const TEXTS_CHANGED =
  'The changelog or release notes differ from the ones checked: give the same ones, or call publish_draft without a confirmation to check again.';
const CHECK_NOT_FOUND =
  'No check of yours has this guardId any more: call publish_draft without a confirmation to start one.';

// The draft to publish: the item's open draft.
async function draftFor({ kind, id }) {
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
    target: {
      kind,
      id,
      version: { major: draft.versionMajor, minor: draft.versionMinor },
    },
  };
}

// The changelog and release notes the publication takes: the assistant's, or
// the draft's. A major without them is refused, as in the back office.
function textsOf(args, draft) {
  return {
    changelog: args.changelog || draft.changelog || undefined,
    releaseNotes: args.releaseNotes || draft.releaseNotes || undefined,
  };
}

// What the key binds of them, so the second call publishes what was checked.
const termsOf = ({ changelog, releaseNotes }) =>
  crypto
    .createHash('sha256')
    .update(JSON.stringify([changelog || '', releaseNotes || '']))
    .digest('base64url');

// A check as the assistant reads it: running, to read again, or done, with
// its cases and the key. A batch of the back office is not one.
function answerOf(run) {
  const [target] = run.targets;
  if (run.targets.length !== 1) throw createError(404, CHECK_NOT_FOUND);
  if (run.status === 'failed') {
    throw createError(
      409,
      `The check did not end (${run.code}): call publish_draft without a confirmation to start it again.`
    );
  }
  const { usedBy, calls, maxCalls, notReplayed, missing, cases } = run;
  const answer = {
    id: target.id,
    version: target.version,
    published: false,
    status: run.status,
    guardId: run.id,
    guard: { usedBy, calls, maxCalls, notReplayed, missing },
  };
  if (run.status === 'running') {
    return {
      ...answer,
      next: `The check runs on the server, about ${calls} AI calls: read it again in a minute or two with read_publication_check.`,
    };
  }
  return {
    ...answer,
    guard: { ...answer.guard, cases },
    confirmation: run.key,
    next:
      'Show the user each test case before and after, then call publish_draft again with the confirmation once they agree.',
  };
}

async function startCheck(args, user) {
  const { doc, draft, target } = await draftFor(args);
  const texts = textsOf(args, draft);
  // What the publication would refuse anyway, before the guard costs a call.
  await publication.checkPublication(target, doc, texts);
  const plan = await publication.planPublication(target);
  const run = await guardRuns.startGuard(
    {
      targets: [target],
      plan,
      run: () =>
        publication.guardPublication(target, user, { terms: termsOf(texts) }),
    },
    user
  );
  // What publishing it would warn of, told before the person agrees.
  const warnings = await publication.consumedWarningsOf(target, doc);
  return { ...answerOf(run), warnings };
}

async function readCheck({ guardId }, user) {
  try {
    return answerOf(await guardRuns.readGuard(guardId, user));
  } catch (err) {
    if (err.status === 404) throw createError(404, CHECK_NOT_FOUND);
    throw err;
  }
}

async function publishChecked(args, user, application) {
  const { draft, target } = await draftFor(args);
  let ran;
  try {
    ran = readGuardKey(args.confirmation, target, user);
  } catch (err) {
    throw createError(400, KEY_REFUSED);
  }
  if (ran.updatedAt !== isoOf(draft.updatedAt)) {
    throw createError(409, DRAFT_CHANGED);
  }
  const texts = textsOf(args, draft);
  if (ran.terms !== termsOf(texts)) throw createError(409, TEXTS_CHANGED);
  const { doc, warnings } = await publication.publishVersion(
    {
      ...target,
      guardKey: args.confirmation,
      application,
      payload: {
        ...texts,
        // On the condition that the draft checked is the one written, up to
        // the write itself (ADR 0014).
        updatedAt: draft.updatedAt,
      },
    },
    user
  );
  return {
    id: target.id,
    version: label(draft),
    published: true,
    guard: ran.guard,
    // What a publication warns of, as on the item's page (ADR 0013).
    warnings: [
      ...warnings,
      ...(await publication.consumedWarningsOf(target, doc)),
    ],
  };
}

const REFUSED =
  'Not allowed: publishing skills and expertises needs the skills:write scope, the right to manage the platform, and a connection to the platform company.';

// Who calls is checked first (`withIdentity`), then whether they may still
// publish; what the services refuse is answered, anything else is logged.
function asPublisher(step) {
  return withIdentity(async ({ user, group }, args, ctx) => {
    const authInfo = ctx?.http?.authInfo;
    if (!mayWrite(user, group, authInfo)) return failure(REFUSED);
    try {
      return success(await step(args, user, authInfo?.clientId));
    } catch (err) {
      if (isRefusal(err)) return refused(err);
      throw err;
    }
  });
}

function registerPublicationTools(server) {
  server.registerTool(
    'publish_draft',
    {
      title: 'Publish a draft',
      description:
        'Publishes a draft of a skill or an expertise, in two steps. Without a confirmation, it starts the publication guard on the server and publishes nothing: the check replays the test cases of the features that use it, which takes a minute or more, so read it again with read_publication_check until it is done. Then show the user each test case before and after, and what the publication warns of, and call again with the confirmation key only once they agree. A difference warns, it never blocks. Publishing changes what LePatron features read at once; it does not open the version to every company.',
      inputSchema: PUBLISH_INPUT,
      outputSchema: ANSWER,
      annotations: OVERWRITING,
    },
    asPublisher((args, user, application) =>
      args.confirmation
        ? publishChecked(args, user, application)
        : startCheck(args, user)
    )
  );
  server.registerTool(
    'read_publication_check',
    {
      title: 'Read a publication check',
      description:
        'Reads the check publish_draft started: still running, or done with each test case before and after and the confirmation key to publish.',
      inputSchema: CHECK_INPUT,
      outputSchema: ANSWER,
      annotations: READ_ONLY,
    },
    asPublisher((args, user) => readCheck(args, user))
  );
}

module.exports = { registerPublicationTools };
