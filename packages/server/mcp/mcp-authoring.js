'use strict';

const { z } = require('zod');
const permissions = require('../account/permissions.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');
const expertiseService = require('../ai-skill/services/expertise.service.js');
const skillService = require('../ai-skill/services/skill.service.js');
const {
  findActiveVersion,
} = require('../ai-skill/services/version-helpers.js');
const {
  SkillCategoryValues,
  SkillNatures,
} = require('../ai-skill/constant/skill-constants.js');
const { resolveIdentity } = require('./mcp-identity.js');

// The scope a token needs for the writing tools to exist (ADR 0014).
const WRITE_SCOPE = 'skills:write';

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

const failure = (text) => ({
  isError: true,
  content: [{ type: 'text', text }],
});
const success = (answer) => ({
  content: [{ type: 'text', text: JSON.stringify(answer) }],
  structuredContent: answer,
});
const label = (v) => `${v.versionMajor}.${v.versionMinor}`;

// Who calls, and whether they may write: the capability is asked again on
// every call, whatever the token says (ADR 0014).
async function authorOf(ctx) {
  const authInfo = ctx.http?.authInfo;
  const { user } = await resolveIdentity(authInfo);
  const scoped = (authInfo.scopes || []).includes(WRITE_SCOPE);
  if (!scoped || !permissions.can(user, CAPABILITIES.PLATFORM_MANAGE)) {
    return null;
  }
  return user;
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

// The open draft, or a new one from the active version: a minor by default, a
// major on request or when nothing is published yet.
async function draftOf(entity, id, major, userId) {
  const { service } = ENTITIES[entity];
  const doc = await service[entity === 'skill' ? 'getSkill' : 'getExpertise'](
    id
  );
  const open = doc.versions
    .filter((v) => v.status === 'DRAFT')
    .sort(
      (a, b) =>
        b.versionMajor - a.versionMajor || b.versionMinor - a.versionMinor
    )[0];
  if (open) return { doc, version: open };
  const next =
    major || !findActiveVersion(doc)
      ? await service.createMajorVersion(id, { userId })
      : await service.createMinorVersion(id, userId);
  const created = next.versions[next.versions.length - 1];
  return { doc: next, version: created };
}

async function writeDraft(entity, id, { major, ...patch }, user) {
  const { service, textOf } = ENTITIES[entity];
  const { version } = await draftOf(entity, id, major, user.id);
  const saved = await service.updateVersion(
    id,
    { major: version.versionMajor, minor: version.versionMinor },
    patch,
    user.id
  );
  const draft = saved.versions.find(
    (v) =>
      v.versionMajor === version.versionMajor &&
      v.versionMinor === version.versionMinor
  );
  const active = findActiveVersion(saved);
  return {
    [ENTITIES[entity].idField]: id,
    version: label(draft),
    status: draft.status,
    audience: saved.audience,
    diff: diffOf(active ? textOf(active) : '', textOf(draft)),
  };
}

// The services rely on the unique index to refuse a duplicate; say it first.
async function assertNew(entity, id) {
  const { service } = ENTITIES[entity];
  const get = entity === 'skill' ? 'getSkill' : 'getExpertise';
  const exists = await service[get](id).then(
    () => true,
    () => false
  );
  if (exists) throw new Error(`"${id}" already exists`);
}

// Runs a write for an author, turning the services' errors into answers.
function asAuthor(write) {
  return async (args, ctx) => {
    const user = await authorOf(ctx);
    if (!user) {
      return failure(
        'Not allowed: drafting skills and expertises needs the skills:write scope and the right to manage the platform.'
      );
    }
    try {
      return success(await write(args, user));
    } catch (err) {
      return failure(err.message || 'The draft could not be written.');
    }
  };
}

const ANSWER = z.object({
  expertiseId: z.string().optional(),
  skillId: z.string().optional(),
  version: z.string(),
  status: z.string(),
  audience: z.string().optional(),
  diff: z.string(),
});
const WRITING = { readOnlyHint: false, destructiveHint: false };
const changelog = z.string().min(1, 'A changelog is required');

function registerAuthoringTools(server) {
  server.registerTool(
    'propose_expertise_change',
    {
      title: 'Propose a change to an expertise',
      description:
        'Writes a change to a Badsender expertise as a draft: the open draft, or a new one from the active version. Never published from here: a person publishes it in the back office. Give a changelog.',
      inputSchema: z.object({
        expertiseId: z.string(),
        body: z.string().optional(),
        examplesGood: z.array(z.string()).optional(),
        examplesBad: z.array(z.string()).optional(),
        changelog,
        major: z.boolean().optional(),
      }),
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
        'Writes a change to a Badsender skill as a draft: the procedure and consumed expertises of a task skill, or the instructions and template of a feature skill. Never published from here. Give a changelog.',
      inputSchema: z.object({
        skillId: z.string(),
        procedure: z.string().optional(),
        consumedExpertiseIds: z.array(z.string()).optional(),
        systemPrompt: z.string().optional(),
        skillBody: z.string().optional(),
        inputTemplate: z.string().optional(),
        changelog,
        major: z.boolean().optional(),
      }),
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
      description:
        'Creates a Badsender expertise as a draft, read by the Badsender team only until a person publishes and opens it in the back office.',
      inputSchema: z.object({
        expertiseId: z.string().regex(/^[a-z0-9._-]+$/),
        title: z.string(),
        category: z.enum(SkillCategoryValues),
        description: z.string().optional(),
        scope: z.array(z.string()).optional(),
        isTransversal: z.boolean().optional(),
        body: z.string(),
        changelog,
      }),
      outputSchema: ANSWER,
      annotations: WRITING,
    },
    asAuthor(async ({ body, changelog: log, ...data }, user) => {
      await assertNew('expertise', data.expertiseId);
      await expertiseService.createExpertise(data, user.id);
      return writeDraft(
        'expertise',
        data.expertiseId,
        { body, changelog: log },
        user
      );
    })
  );

  server.registerTool(
    'create_task_skill',
    {
      title: 'Create a task skill',
      description:
        'Creates a Badsender task skill (a procedure for an assistant, with the expertises it consumes in order) as a draft, read by the Badsender team only until a person publishes and opens it.',
      inputSchema: z.object({
        skillId: z.string().regex(/^[a-z0-9._-]+$/),
        title: z.string(),
        category: z.enum(SkillCategoryValues),
        description: z.string().optional(),
        procedure: z.string(),
        consumedExpertiseIds: z.array(z.string()).optional(),
        changelog,
      }),
      outputSchema: ANSWER,
      annotations: WRITING,
    },
    asAuthor(
      async (
        { procedure, consumedExpertiseIds, changelog: log, ...data },
        user
      ) => {
        await assertNew('skill', data.skillId);
        await skillService.createSkill(
          { ...data, nature: SkillNatures.TASK },
          user.id
        );
        return writeDraft(
          'skill',
          data.skillId,
          {
            procedure,
            consumedExpertiseIds: consumedExpertiseIds || [],
            changelog: log,
          },
          user
        );
      }
    )
  );
}

module.exports = { registerAuthoringTools, WRITE_SCOPE };
