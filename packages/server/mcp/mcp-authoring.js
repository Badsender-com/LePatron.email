'use strict';

const { z } = require('zod');
const createError = require('http-errors');
const expertiseService = require('../ai-skill/services/expertise.service.js');
const skillService = require('../ai-skill/services/skill.service.js');
const {
  findActiveVersion,
  openDraftOf,
  versionLabel: label,
} = require('../ai-skill/services/version-helpers.js');
const {
  Audiences,
  AudienceValues,
  SkillCategoryValues,
  SkillNatures,
  SkillStatuses,
  SkillIdRegex,
  MaxConsumedExpertises,
} = require('../ai-skill/constant/skill-constants.js');
const {
  platformOnlyExpertises,
} = require('../ai-skill/services/consumed-expertises.js');
const {
  openTaskSkillsConsuming,
} = require('../ai-skill/services/audience-opening.js');
const logger = require('../utils/logger.js');
const { withIdentity, mayDraft } = require('./mcp-identity.js');
const {
  failure,
  ADDITIVE,
  OVERWRITING,
  SWITCHING,
} = require('./mcp-tool-grammar.js');
const {
  addressesRetex,
  addressedRetex,
  assertCitable,
  citeIn,
} = require('./mcp-authoring-retex.js');

// Said in an answer whose change is saved, when what it leaves behind could
// not be read.
const WARNING_UNCHECKED = 'WARNING_UNCHECKED';

const ENTITIES = {
  expertise: {
    service: expertiseService,
    get: 'getExpertise',
    update: 'updateExpertise',
    idField: 'expertiseId',
    textOf: (v) =>
      [v.body, ...(v.examplesGood || []), ...(v.examplesBad || [])].join('\n'),
  },
  skill: {
    service: skillService,
    get: 'getSkill',
    update: 'updateSkill',
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

const success = (answer) => ({
  content: [{ type: 'text', text: JSON.stringify(answer) }],
  structuredContent: answer,
});

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
// major on request or when nothing is published yet. A major is never written
// into an open minor, nor a draft started on an archived skill or expertise.
async function draftOf(entity, id, major, userId) {
  const { service, get } = ENTITIES[entity];
  const doc = await service[get](id);
  if (doc.status === 'ARCHIVED') {
    throw createError(409, `"${id}" is archived: it takes no new draft.`);
  }
  const open = openDraftOf(doc);
  if (open && major && open.versionMinor > 0) {
    throw createError(
      409,
      `The minor draft ${label(
        open
      )} is open: propose this change to it, or ask a person to publish or discard it before a major version.`
    );
  }
  if (open) return { doc, version: open };
  const next =
    major || !findActiveVersion(doc)
      ? await service.createMajorVersion(id, { userId })
      : await service.createMinorVersion(id, userId);
  const created = next.versions[next.versions.length - 1];
  return { doc: next, version: created };
}

async function writeDraft(
  entity,
  id,
  { major, addressesRetex, ...patch },
  user
) {
  const { service, textOf } = ENTITIES[entity];
  await assertCitable(addressesRetex);
  const { version } = await draftOf(entity, id, major, user.id);
  const saved = await service.updateVersion(
    id,
    { major: version.versionMajor, minor: version.versionMinor },
    patch,
    user.id
  );
  const cited = await citeIn(service, id, version, addressesRetex, user.id);
  const draft = saved.versions.find(
    (v) =>
      v.versionMajor === version.versionMajor &&
      v.versionMinor === version.versionMinor
  );
  const active = findActiveVersion(saved);
  return {
    [ENTITIES[entity].idField]: id,
    version: label(draft),
    // Lower case, as every other state an assistant reads.
    status: String(draft.status).toLowerCase(),
    audience: saved.audience,
    diff: diffOf(active ? textOf(active) : '', textOf(draft)),
    addressesRetex: cited,
  };
}

// The services rely on the unique index to refuse a duplicate; say it first.
async function assertNew(entity, id) {
  const { service, get } = ENTITIES[entity];
  const exists = await service[get](id).then(
    () => true,
    () => false
  );
  if (exists) throw createError(409, `"${id}" already exists.`);
}

// Whether the services refused the write with a message meant to be shown
// (an `http-errors` 4xx): anything else is not for the assistant, and
// `withIdentity` logs it and answers a plain message.
const isRefusal = (err) =>
  Boolean(err) && err.expose === true && err.status >= 400 && err.status < 500;

const DRAFTING_REFUSED =
  'Not allowed: drafting skills and expertises needs the skills:write scope and the right to manage the platform.';

// Runs a write for an author, who calls checked first (`withIdentity`), and
// answers what the services refuse.
function asAuthor(write, refusal = DRAFTING_REFUSED) {
  return withIdentity(async ({ user }, args, ctx) => {
    if (!mayDraft(user, ctx?.http?.authInfo)) return failure(refusal);
    try {
      return success(await write(args, user));
    } catch (err) {
      if (isRefusal(err)) return failure(err.message);
      throw err;
    }
  });
}

// What opening or closing leaves behind, read once the audience is saved:
// a failure to read it is logged and said, never answered as an error.
async function audienceNotes(kind, id, active, opening) {
  try {
    if (kind === 'skill' && opening) {
      return { platformOnlyExpertises: await platformOnlyExpertises(active) };
    }
    if (kind === 'expertise' && !opening) {
      return { openTaskSkills: await openTaskSkillsConsuming(id) };
    }
    return {};
  } catch (error) {
    logger.error(
      `[mcp] what the audience of ${kind} ${id} leaves behind could not be read`,
      error
    );
    return { warnings: [{ code: WARNING_UNCHECKED }] };
  }
}

/**
 * Opens an active skill or expertise to every company, or keeps it to the
 * platform company again, through the services the back office uses (ADR
 * 0019, ADR 0013). Clients read the active version only, so a version never
 * published is never opened. A task skill opened may open with it the
 * consumed expertises still kept to the platform company, chosen one by one
 * (`openExpertiseIds`), as the back office's confirmation offers; the answer
 * lists those it leaves kept, and, for an expertise kept again, the open task
 * skills that consume it.
 */
async function setAudience({ kind, id, audience, openExpertiseIds }) {
  const { service, get } = ENTITIES[kind];
  const doc = await service[get](id);
  const active = findActiveVersion(doc);
  const opening = audience === Audiences.ALL;
  if (opening && doc.status === SkillStatuses.ARCHIVED) {
    throw createError(409, `"${id}" is archived: it is opened to no company.`);
  }
  if (opening && !active) {
    throw createError(
      409,
      `"${id}" was never published: a person publishes a version before it is opened.`
    );
  }
  if (openExpertiseIds !== undefined && (kind !== 'skill' || !opening)) {
    throw createError(
      400,
      'openExpertiseIds goes only with opening a skill to every company.'
    );
  }
  let saved;
  let warnings = [];
  if (kind === 'skill') {
    ({ skill: saved, warnings } = await skillService.updateSkill(id, {
      audience,
      ...(openExpertiseIds !== undefined && { openExpertiseIds }),
    }));
  } else {
    saved = await expertiseService.updateExpertise(id, { audience });
  }
  const notes = await audienceNotes(kind, id, active, opening);
  return {
    id,
    audience: saved.audience,
    clientsRead: active ? label(active) : null,
    ...notes,
    warnings: [...warnings, ...(notes.warnings || [])],
  };
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
  .max(MAX_CHANGELOG_LENGTH)
  .describe('What changes and why, in a sentence or two, in French.');

const ANSWER = z.object({
  expertiseId: z.string().optional(),
  skillId: z.string().optional(),
  version: z.string(),
  status: z.enum(['draft']),
  audience: z.string().optional(),
  diff: z.string(),
  addressesRetex: addressedRetex,
});
const major = z
  .boolean()
  .optional()
  .describe(
    'true for a major version (a change of meaning). Default: a minor one.'
  );
const newIdOf = (kind) =>
  NEW_ID.describe(
    `The ${kind} id: lower case letters, digits, dots, dashes and underscores, e.g. redaction.subject.length.`
  );
const categoryParam = z
  .enum(SkillCategoryValues)
  .describe(`One of: ${SkillCategoryValues.join(', ')}.`);
const expertiseIds = CONSUMED.optional().describe(
  `The expertiseIds the procedure reads, in the order it reads them, ${MaxConsumedExpertises} at most.`
);

const PROPOSE_EXPERTISE_INPUT = z.object({
  expertiseId: ID.describe(
    'The expertise to change, as find_applicable_expertises gives it.'
  ),
  body: TEXT.optional().describe(
    'The whole new text, in Markdown. Left out: unchanged.'
  ),
  examplesGood: EXAMPLES.optional().describe(
    'The whole new list of good examples. Left out: unchanged.'
  ),
  examplesBad: EXAMPLES.optional().describe(
    'The whole new list of bad examples. Left out: unchanged.'
  ),
  changelog,
  addressesRetex,
  major,
});
const PROPOSE_SKILL_INPUT = z.object({
  skillId: ID.describe('The skill to change, as find_skills gives it.'),
  procedure: TEXT.optional().describe(
    'A task skill: the whole new procedure, in Markdown.'
  ),
  consumedExpertiseIds: expertiseIds,
  systemPrompt: TEXT.optional().describe(
    'A feature skill: the whole new instructions.'
  ),
  skillBody: TEXT.optional().describe('A feature skill: the whole new body.'),
  inputTemplate: TEXT.optional().describe(
    'A feature skill: the whole new input template.'
  ),
  changelog,
  addressesRetex,
  major,
});
const CREATE_EXPERTISE_INPUT = z.object({
  expertiseId: newIdOf('expertise'),
  title: TITLE.describe('Its title, in French.'),
  category: categoryParam,
  description: DESCRIPTION.optional().describe(
    'What it covers, in a sentence, in French.'
  ),
  scope: z
    .array(z.string().max(MAX_SCOPE_LENGTH))
    .max(MAX_SCOPES)
    .optional()
    .describe(
      'The parts of the email it applies to, e.g. ["subject", "preheader"].'
    ),
  isTransversal: z
    .boolean()
    .optional()
    .describe('true if it applies to every part of the email.'),
  body: TEXT.describe('Its text, in Markdown, in French.'),
  changelog,
  addressesRetex,
});
const CREATE_TASK_SKILL_INPUT = z.object({
  skillId: newIdOf('skill'),
  title: TITLE.describe('Its title, in French.'),
  category: categoryParam,
  description: DESCRIPTION.optional().describe(
    'When to use it, in a sentence, in French: find_skills matches on it.'
  ),
  procedure: TEXT.describe(
    'The procedure an assistant follows, in Markdown, in French.'
  ),
  consumedExpertiseIds: expertiseIds,
  changelog,
  addressesRetex,
});

const SET_AUDIENCE_INPUT = z.object({
  kind: z.enum(['skill', 'expertise']).describe('One of: skill, expertise.'),
  id: ID.describe(
    'The skillId or expertiseId, as find_skills or find_applicable_expertises gives it.'
  ),
  audience: z
    .enum(AudienceValues)
    .describe(
      'all: every company, in the editor and in the assistants of those with MCP access; platform: the platform company only.'
    ),
  openExpertiseIds: CONSUMED.optional().describe(
    'Opening a task skill only: the expertises it consumes that are kept to the platform company, as platformOnlyExpertises listed them, to open to every company with it. Opening an expertise also applies it, at once, to the editor features of every company: ask the user for each one.'
  ),
});
const AUDIENCE_ANSWER = z.object({
  id: z.string(),
  audience: z.enum(AudienceValues),
  clientsRead: z
    .string()
    .nullable()
    .describe('The version clients read, null when none was published.'),
  platformOnlyExpertises: z
    .array(z.object({ expertiseId: z.string(), title: z.string() }))
    .optional()
    .describe(
      'A task skill opened: the expertises it consumes still kept to the platform company, which the assistants of the other companies follow it without.'
    ),
  openTaskSkills: z
    .array(z.object({ skillId: z.string(), title: z.string() }))
    .optional()
    .describe(
      'An expertise kept to the platform company again: the task skills open to every company that consume it, and no longer receive it at the clients.'
    ),
  warnings: z
    .array(
      z.object({
        code: z.string(),
        expertiseIds: z.array(z.string()).optional(),
      })
    )
    .describe('What the change could not do or check, if anything.'),
});

function registerAuthoringTools(server) {
  server.registerTool(
    'propose_expertise_change',
    {
      title: 'Propose a change to an expertise',
      description:
        'Writes a change to an expertise as a draft: the open draft, or a new one from the active version. Never published from here: a person publishes it in the back office. Give a changelog.',
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
      description:
        'Creates an expertise as a draft, read by the platform company only until a person publishes it in the back office and it is opened to every company (set_audience).',
      inputSchema: CREATE_EXPERTISE_INPUT,
      outputSchema: ANSWER,
      annotations: ADDITIVE,
    },
    asAuthor(
      async (
        { body, changelog: log, addressesRetex: cited, ...data },
        user
      ) => {
        await assertNew('expertise', data.expertiseId);
        await assertCitable(cited);
        await expertiseService.createExpertise(data, user.id);
        return writeDraft(
          'expertise',
          data.expertiseId,
          { body, changelog: log, addressesRetex: cited },
          user
        );
      }
    )
  );

  server.registerTool(
    'create_task_skill',
    {
      title: 'Create a task skill',
      description:
        'Creates a task skill (a procedure for an assistant, with the expertises it consumes in order) as a draft, read by the platform company only until a person publishes it and it is opened to every company (set_audience).',
      inputSchema: CREATE_TASK_SKILL_INPUT,
      outputSchema: ANSWER,
      annotations: ADDITIVE,
    },
    asAuthor(
      async (
        {
          procedure,
          consumedExpertiseIds,
          changelog: log,
          addressesRetex: cited,
          ...data
        },
        user
      ) => {
        await assertNew('skill', data.skillId);
        await assertCitable(cited);
        await skillService.createSkill(data, user.id);
        // The nature is the version's (ADR 0013): its first draft is a task.
        return writeDraft(
          'skill',
          data.skillId,
          {
            nature: SkillNatures.TASK,
            procedure,
            consumedExpertiseIds: consumedExpertiseIds || [],
            changelog: log,
            addressesRetex: cited,
          },
          user
        );
      }
    )
  );

  server.registerTool(
    'set_audience',
    {
      title: 'Open or close a skill or an expertise',
      description:
        'Opens a published skill or expertise to every company, or keeps it to the platform company again. Only its active version is opened, never a draft: the answer says which version clients read. Opening a task skill answers the expertises it consumes that stay kept to the platform company (platformOnlyExpertises): tell the user, and call again with openExpertiseIds for those they choose to open too. Keeping an expertise to the platform company again answers the open task skills that consume it (openTaskSkills). Ask the user before any change.',
      inputSchema: SET_AUDIENCE_INPUT,
      outputSchema: AUDIENCE_ANSWER,
      annotations: SWITCHING,
    },
    asAuthor(
      setAudience,
      'Not allowed: opening or closing skills and expertises needs the skills:write scope and the right to manage the platform.'
    )
  );
}

module.exports = { registerAuthoringTools, mayDraft, isRefusal };
