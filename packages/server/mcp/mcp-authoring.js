'use strict';

const { z } = require('zod');
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
  SkillCategoryValues,
  SkillNatures,
  SkillIdRegex,
  MaxConsumedExpertises,
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

const ENTITIES = {
  expertise: {
    service: expertiseService,
    idField: 'expertiseId',
    textOf: (v) =>
      [v.body, ...(v.examplesGood || []), ...(v.examplesBad || [])].join('\n'),
  },
  skill: {
    service: skillService,
    idField: 'skillId',
    textOf: (v) =>
      [
        v.procedure,
        ...(v.consumedExpertiseIds || []),
        v.systemPrompt,
        v.skillBody,
        v.inputTemplate,
      ].join('\n'),
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

// The lines the draft adds and removes against the active version, for the
// person to read before publishing.
function diffOf(activeText, draftText) {
  const lines = (text) =>
    String(text || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  const before = lines(activeText);
  const after = lines(draftText);
  return [
    ...before.filter((line) => !after.includes(line)).map((l) => `- ${l}`),
    ...after.filter((line) => !before.includes(line)).map((l) => `+ ${l}`),
  ].join('\n');
}

// What a write answers: the version written, and its difference with the
// active version, for the person to read before publishing.
function answerOf(entity, doc, draft) {
  const { idField, textOf } = ENTITIES[entity];
  const active = findActiveVersion(doc);
  return {
    [idField]: doc[idField],
    version: label(draft),
    status: draft.status,
    audience: doc.audience,
    diff: diffOf(active ? textOf(active) : '', textOf(draft)),
  };
}

// The changelog of a draft a proposal writes into: the draft's own, then the
// proposal's, so that what a person or an earlier proposal wrote stays. A
// draft this proposal started has only the default of a new version.
function changelogAfter(version, started, changelog) {
  const before = started ? '' : String(version.changelog || '').trim();
  return before ? `${before}\n${changelog}` : changelog;
}

// The open draft, or a new one the versioning service starts (ADR 0014).
async function writeDraft(entity, id, { major, ...patch }, user) {
  const { service } = ENTITIES[entity];
  const { version, started } = await service.openOrStartDraft(id, {
    major,
    userId: user.id,
  });
  const ref = { major: version.versionMajor, minor: version.versionMinor };
  const saved = await service.updateVersion(
    id,
    ref,
    { ...patch, changelog: changelogAfter(version, started, patch.changelog) },
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
  throw createError(409, `"${id}" already exists`);
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

// Runs a write for an author, who calls checked first (`withIdentity`), and
// answers what the services refuse.
function asAuthor(write) {
  return withIdentity(async ({ user }, args, ctx) => {
    if (!mayDraft(user, ctx?.http?.authInfo)) {
      return failure(
        'Not allowed: drafting skills and expertises needs the skills:write scope and the right to manage the platform.'
      );
    }
    try {
      return success(await write(args, user));
    } catch (err) {
      // What the services refuse is the assistant's to fix; anything else
      // is not for it, and `withIdentity` logs it and answers a plain message.
      if (isRefusal(err)) return refused(err);
      throw err;
    }
  });
}

// What an assistant may send: bounded, like every input of this server.
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
  .max(MAX_CHANGELOG_LENGTH);

const ANSWER = z.object({
  expertiseId: z.string().optional(),
  skillId: z.string().optional(),
  version: z.string(),
  status: z.string(),
  audience: z.string().optional(),
  diff: z.string(),
});
const WRITING = { readOnlyHint: false, destructiveHint: false };

// How an expertise's body is cut into sections, which the server checks.
const SECTIONS =
  'The body is Markdown; each section is a level-2 heading "## [section-id] Title", its id in lowercase letters, digits and hyphens, once per expertise.';

const PROPOSE_EXPERTISE_INPUT = z.object({
  expertiseId: ID,
  body: TEXT.optional(),
  examplesGood: EXAMPLES.optional(),
  examplesBad: EXAMPLES.optional(),
  changelog,
  major: z.boolean().optional(),
});
const PROPOSE_SKILL_INPUT = z.object({
  skillId: ID,
  procedure: TEXT.optional(),
  consumedExpertiseIds: CONSUMED.optional(),
  systemPrompt: TEXT.optional(),
  skillBody: TEXT.optional(),
  inputTemplate: TEXT.optional(),
  changelog,
  major: z.boolean().optional(),
});
const CREATE_EXPERTISE_INPUT = z.object({
  expertiseId: NEW_ID,
  title: TITLE,
  category: z.enum(SkillCategoryValues),
  description: DESCRIPTION.optional(),
  scope: z.array(z.string().max(MAX_SCOPE_LENGTH)).max(MAX_SCOPES).optional(),
  isTransversal: z.boolean().optional(),
  body: TEXT,
  changelog,
});
const CREATE_TASK_SKILL_INPUT = z.object({
  skillId: NEW_ID,
  title: TITLE,
  category: z.enum(SkillCategoryValues),
  description: DESCRIPTION.optional(),
  procedure: TEXT,
  consumedExpertiseIds: CONSUMED.optional(),
  changelog,
});

function registerAuthoringTools(server) {
  server.registerTool(
    'propose_expertise_change',
    {
      title: 'Propose a change to an expertise',
      description: `Writes a change to an expertise as a draft: the open draft, or a new one from the active version. Never published from here: a person publishes it in the back office. Give a changelog. ${SECTIONS}`,
      inputSchema: PROPOSE_EXPERTISE_INPUT,
      outputSchema: ANSWER,
      annotations: WRITING,
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
      annotations: WRITING,
    },
    asAuthor(({ skillId, ...change }, user) =>
      writeDraft('skill', skillId, change, user)
    )
  );

  server.registerTool(
    'create_expertise',
    {
      title: 'Create an expertise',
      description: `Creates an expertise as a draft, which no assistant reads: a person publishes it in the back office, and it stays with the platform company until a person opens it to every company. ${SECTIONS}`,
      inputSchema: CREATE_EXPERTISE_INPUT,
      outputSchema: ANSWER,
      annotations: WRITING,
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
        'Creates a task skill (a procedure for an assistant, with the expertises it consumes in order) as a draft, which no assistant reads: a person publishes it in the back office, and it stays with the platform company until a person opens it to every company.',
      inputSchema: CREATE_TASK_SKILL_INPUT,
      outputSchema: ANSWER,
      annotations: WRITING,
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
}

module.exports = { registerAuthoringTools };
