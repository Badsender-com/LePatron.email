'use strict';

const createError = require('http-errors');
const permissions = require('../account/permissions.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');
const expertiseService = require('../ai-skill/services/expertise.service.js');
const skillService = require('../ai-skill/services/skill.service.js');
const {
  findActiveVersion,
  findVersion,
  versionLabel: label,
} = require('../ai-skill/services/version-helpers.js');
const {
  Audiences,
  SkillNatures,
  MinorVersionDefaults,
} = require('../ai-skill/constant/skill-constants.js');
const {
  withIdentity,
  hasScope,
  isRefusal,
  failure,
  refused,
  success,
  WRITE_SCOPE,
} = require('./mcp-identity.js');
const { draftDiff, differs } = require('./mcp-draft-diff.js');
const {
  ANSWER,
  PROPOSE_EXPERTISE_INPUT,
  PROPOSE_SKILL_INPUT,
  CREATE_EXPERTISE_INPUT,
  CREATE_TASK_SKILL_INPUT,
  SET_AUDIENCE_INPUT,
  AUDIENCE_ANSWER,
} = require('./mcp-authoring.schemas.js');
const { ADDITIVE, OVERWRITING, SWITCHING } = require('./mcp-tool-grammar.js');
const { setAudience } = require('./mcp-audience.js');

// What an assistant writes of each, and the fields its difference shows.
const ENTITIES = {
  expertise: {
    service: expertiseService,
    idField: 'expertiseId',
    fields: ['body', 'examplesGood', 'examplesBad'],
  },
  skill: {
    service: skillService,
    idField: 'skillId',
    fields: [
      'procedure',
      'consumedExpertiseIds',
      'systemPrompt',
      'skillBody',
      'inputTemplate',
    ],
  },
};

// Whether who calls may write: the capability is asked again on every call,
// whatever the token says (ADR 0014).
function mayDraft(user, authInfo) {
  return (
    hasScope(authInfo, WRITE_SCOPE) &&
    permissions.can(user, CAPABILITIES.PLATFORM_MANAGE)
  );
}

// What a write answers: the version written, and its difference with the
// active version, for the person to read before publishing.
function answerOf(entity, doc, draft) {
  const { idField, fields } = ENTITIES[entity];
  return {
    answer: {
      [idField]: doc[idField],
      version: label(draft),
      // Lower case, as every other state an assistant reads.
      status: String(draft.status).toLowerCase(),
      audience: doc.audience,
    },
    diff: draftDiff(findActiveVersion(doc), draft, fields),
    differs: differs(findActiveVersion(doc), draft, fields),
  };
}

// What the person reads of the difference: the diff, or why there is none.
function differenceSaid(diff, changed) {
  if (diff) {
    return `Its difference with the active version, for the person to read before publishing:\n${diff}`;
  }
  return changed
    ? 'Only spaces or blank lines differ from the active version.'
    : 'It does not differ from the active version.';
}

// The tool's result: the difference is sent once, in the text every client
// reads, and the structured answer says what was written.
function drafted({ answer, diff, differs: changed }) {
  const id = answer.expertiseId || answer.skillId;
  const kept =
    answer.audience === Audiences.ALL
      ? 'open to every company'
      : 'kept to the platform company';
  const said = differenceSaid(diff, changed);
  return {
    content: [
      {
        type: 'text',
        text: `Draft ${answer.version} of "${id}" written, ${kept}: a person publishes it in the back office. ${said}`,
      },
    ],
    structuredContent: answer,
  };
}

// The changelog of a draft a proposal writes into: the draft's own, then the
// proposal's, so that what a person or an earlier proposal wrote stays. The
// default of a new minor version says nothing, and counts as empty. Bounded,
// so a draft proposed to again and again stays readable.
const MAX_DRAFT_CHANGELOG = 10000;

function changelogAfter(version, changelog) {
  const before = String(version.changelog || '').trim();
  const said = before && before !== MinorVersionDefaults.changelog;
  const after = said ? `${before}\n${changelog}` : changelog;
  if (after.length > MAX_DRAFT_CHANGELOG) {
    throw createError(
      400,
      `The changelog of this draft would exceed ${MAX_DRAFT_CHANGELOG} characters: ask a person to shorten it in the back office before proposing more.`
    );
  }
  return after;
}

// The open draft, or a new one the versioning service starts, written on the
// condition that it did not change since it was read (ADR 0014).
async function writeDraft(entity, id, { major, ...patch }, user) {
  const { service } = ENTITIES[entity];
  const { doc, version } = await service.openOrStartDraft(id, {
    major,
    userId: user.id,
  });
  const ref = { major: version.versionMajor, minor: version.versionMinor };
  const saved = await service.writeDraftIfUnchanged(
    doc,
    version,
    { ...patch, changelog: changelogAfter(version, patch.changelog) },
    user.id
  );
  return answerOf(entity, saved, findVersion(saved, ref.major, ref.minor));
}

// The services rely on the unique index to refuse a duplicate; say it first.
// Only an answer that it does not exist lets the creation go on.
async function assertNew(entity, id) {
  const { service } = ENTITIES[entity];
  const get = entity === 'skill' ? 'getSkill' : 'getExpertise';
  try {
    await service[get](id);
  } catch (err) {
    if (err.status === 404) return;
    throw err;
  }
  throw createError(409, `"${id}" already exists.`);
}

// A creation is one write, the v1.0 draft whole: nothing is left behind when
// any of it is refused.
async function createDraft(entity, data, firstVersion, user) {
  const { service, idField } = ENTITIES[entity];
  await assertNew(entity, data[idField]);
  const created =
    entity === 'skill'
      ? await service.createSkill(data, user.id, firstVersion)
      : await service.createExpertise(data, user.id, firstVersion);
  return answerOf(entity, created, created.versions[0]);
}

const DRAFTING_REFUSED =
  'Not allowed: drafting skills and expertises needs the skills:write scope and the right to manage the platform.';

// Runs a write for an author, who calls checked first (`withIdentity`), and
// answers what the services refuse: a draft as `drafted` says it, anything
// else as it is.
function asAuthor(write, refusal = DRAFTING_REFUSED, present = drafted) {
  return withIdentity(async ({ user }, args, ctx) => {
    if (!mayDraft(user, ctx?.http?.authInfo)) return failure(refusal);
    try {
      return present(await write(args, user));
    } catch (err) {
      // What the services refuse is the assistant's to fix; anything else
      // is not for it, and `withIdentity` logs it and answers a plain message.
      if (isRefusal(err)) return refused(err);
      throw err;
    }
  });
}

// How an expertise's body is cut into sections, which the server checks.
const SECTIONS =
  'The body is Markdown; each section is a level-2 heading "## [section-id] Title", its id in lowercase letters, digits and hyphens, once per expertise.';

function registerAuthoringTools(server) {
  server.registerTool(
    'propose_expertise_change',
    {
      title: 'Propose a change to an expertise',
      description: `Writes a change to an expertise as a draft: the open draft, or a new one from the active version. Never published from here: a person publishes it in the back office. Give a changelog. ${SECTIONS}`,
      inputSchema: PROPOSE_EXPERTISE_INPUT,
      outputSchema: ANSWER,
      annotations: OVERWRITING,
    },
    asAuthor(({ expertiseId, ...change }, user) =>
      writeDraft('expertise', expertiseId, change, user)
    )
  );

  server.registerTool(
    'propose_skill_change',
    {
      title: 'Propose a change to a skill',
      description:
        'Writes a change to a skill as a draft: the procedure and consumed expertises of a task skill, or the instructions and template of a feature skill. Never published from here. Give a changelog.',
      inputSchema: PROPOSE_SKILL_INPUT,
      outputSchema: ANSWER,
      annotations: OVERWRITING,
    },
    asAuthor(({ skillId, ...change }, user) =>
      writeDraft('skill', skillId, change, user)
    )
  );

  server.registerTool(
    'create_expertise',
    {
      title: 'Create an expertise',
      description: `Creates an expertise as a draft, which no assistant reads: a person publishes it in the back office, and it stays with the platform company until it is opened to every company (set_audience). ${SECTIONS}`,
      inputSchema: CREATE_EXPERTISE_INPUT,
      outputSchema: ANSWER,
      annotations: ADDITIVE,
    },
    asAuthor(({ body, changelog: log, ...data }, user) =>
      createDraft('expertise', data, { body, changelog: log }, user)
    )
  );

  server.registerTool(
    'create_task_skill',
    {
      title: 'Create a task skill',
      description:
        'Creates a task skill (a procedure for an assistant, with the expertises it consumes in order) as a draft, which no assistant reads: a person publishes it in the back office, and it stays with the platform company until it is opened to every company (set_audience).',
      inputSchema: CREATE_TASK_SKILL_INPUT,
      outputSchema: ANSWER,
      annotations: ADDITIVE,
    },
    asAuthor(
      ({ procedure, consumedExpertiseIds, changelog: log, ...data }, user) =>
        // The nature is the version's (ADR 0013): its first draft is a task.
        createDraft(
          'skill',
          data,
          {
            nature: SkillNatures.TASK,
            procedure,
            consumedExpertiseIds: consumedExpertiseIds || [],
            changelog: log,
          },
          user
        )
    )
  );

  server.registerTool(
    'set_audience',
    {
      title: 'Open or close a skill or an expertise',
      description:
        'Opens a published skill or expertise to every company, or keeps it to the platform company again, in two calls. Without a confirmation, it changes nothing: it answers which version clients will read and what the change leaves behind, with a confirmation key. Opening a task skill names the expertises it consumes that stay kept to the platform company (platformOnlyExpertises): ask the user which to open too, and check again with openExpertiseIds. Keeping an expertise to the platform company again names the open task skills that consume it (openTaskSkills). Tell the user, then call again with the same arguments and the key only once they agree. Only the active version is ever opened, never a draft.',
      inputSchema: SET_AUDIENCE_INPUT,
      outputSchema: AUDIENCE_ANSWER,
      annotations: SWITCHING,
    },
    asAuthor(
      setAudience,
      'Not allowed: opening or closing skills and expertises needs the skills:write scope and the right to manage the platform.',
      success
    )
  );
}

module.exports = { registerAuthoringTools };
