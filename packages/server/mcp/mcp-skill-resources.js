'use strict';

const { z } = require('zod');
const {
  ResourceTemplate,
  ResourceNotFoundError,
} = require('@modelcontextprotocol/server');
const { withIdentity } = require('./mcp-identity.js');
const { versionLabel } = require('../ai-skill/services/version-helpers.js');
const {
  uriOf,
  natureOf,
  isTask,
  servedSkills,
  servedSkill,
  usesExpertise,
  EXPERTISE_NOTICE,
} = require('./mcp-skill-catalog.js');
const expertises = require('./mcp-expertises.js');
const {
  SkillNatureValues,
} = require('../ai-skill/constant/skill-constants.js');
const { draftNotice } = require('./mcp-drafts.js');
const { READ_ONLY } = require('./mcp-tool-grammar.js');

// What an assistant reads of a skill: a task skill's procedure and the
// expertises it consumes, a feature skill's instructions. An MCP prompt is only
// chosen by the user; a resource lets the assistant pick a skill itself. It
// lists only the consumed expertises the company may read, as the prompt does.
function asMarkdown(found, readableIds = []) {
  const { doc, version } = found;
  const notice = draftNotice(found);
  const body = isTask(version)
    ? version.procedure
    : [
        version.systemPrompt,
        version.skillBody,
        usesExpertise(version) && EXPERTISE_NOTICE,
      ]
        .filter(Boolean)
        .join('\n\n');
  const consumed = readableIds.map((id) => `- ${expertises.uriOf(id)}`);
  return [
    `# ${doc.title}`,
    '',
    `Version ${versionLabel(version)}.`,
    '',
    ...(notice ? [notice, ''] : []),
    body,
    ...(consumed.length
      ? ['', '## Expertises to read first, in this order', '', ...consumed]
      : []),
  ].join('\n');
}

function asResource({ doc, version, draft }) {
  return {
    uri: uriOf(doc.skillId),
    name: doc.skillId,
    title: draft ? `${doc.title} (draft ${versionLabel(version)})` : doc.title,
    description: doc.description || undefined,
    mimeType: 'text/markdown',
  };
}

function registerSkillResources(server) {
  server.registerResource(
    'skills',
    new ResourceTemplate('lepatron://skills/{skillId}', {
      list: withIdentity(async ({ group, drafts }) => ({
        resources: (await servedSkills(group, drafts)).map(asResource),
      })),
    }),
    {
      title: 'Skills',
      description:
        'Procedures written for an assistant, to run on what the user provides.',
      mimeType: 'text/markdown',
    },
    withIdentity(async ({ group, drafts }, uri, { skillId }) => {
      const found = await servedSkill(skillId, group, drafts);
      if (!found) throw new ResourceNotFoundError(uri.href);
      const readable = await expertises.consumedExpertises(
        found.version.consumedExpertiseIds,
        group,
        { drafts }
      );
      const readableIds = readable.map(({ doc }) => doc.expertiseId);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/markdown',
            text: asMarkdown(found, readableIds),
          },
        ],
      };
    })
  );
}

// What an assistant may send, and how many skills that match it is answered.
// Without a query, or when none matches, the list of the skills is answered.
const MAX_QUERY_LENGTH = 200;
const MAX_FOUND_SKILLS = 10;

const FIND_INPUT = z.object({
  query: z
    .string()
    .max(MAX_QUERY_LENGTH)
    .regex(/\S/, 'A query is not blank')
    .optional()
    .describe(
      'What the user wants to do, in French words. Without it, every skill is listed.'
    ),
});
const FIND_OUTPUT = z.object({
  skills: z.array(
    z.object({
      skillId: z.string(),
      title: z.string(),
      description: z.string(),
      nature: z.enum(SkillNatureValues),
      draft: z.boolean().optional(),
      uri: z.string(),
    })
  ),
  matched: z.boolean(),
});

// Every word of the query, in the identifier, the title or the description,
// whatever the case.
function matching(query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return ({ doc }) => {
    const haystack = `${doc.skillId} ${doc.title} ${
      doc.description || ''
    }`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  };
}

function registerFindSkills(server) {
  server.registerTool(
    'find_skills',
    {
      title: 'Find a skill',
      description: `Finds the skills whose identifier, title or description match what the user wants to do, ${MAX_FOUND_SKILLS} at most. They are written in French: search with French words. When nothing matches, or without a query, every skill is listed (matched is false then): pick by their descriptions. Read the one that fits through its resource URI, then follow it.`,
      inputSchema: FIND_INPUT,
      outputSchema: FIND_OUTPUT,
      annotations: READ_ONLY,
    },
    withIdentity(async ({ group, drafts }, { query }) => {
      const served = await servedSkills(group, drafts);
      // Words of another language than the skills' match nothing: the whole
      // list is then answered, for the assistant to choose from (it is the
      // list of the skills' prompts and resources).
      const found = query ? served.filter(matching(query)) : [];
      const matched = found.length > 0;
      const skills = (matched ? found.slice(0, MAX_FOUND_SKILLS) : served).map(
        ({ doc, version, draft }) => ({
          skillId: doc.skillId,
          title: doc.title,
          description: doc.description || '',
          nature: natureOf(version),
          ...(draft && { draft: true }),
          uri: uriOf(doc.skillId),
        })
      );
      const answer = { skills, matched };
      return {
        content: [{ type: 'text', text: JSON.stringify(answer) }],
        structuredContent: answer,
      };
    })
  );
}

module.exports = { registerSkillResources, registerFindSkills };
