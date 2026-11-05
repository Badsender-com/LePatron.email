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

// What an assistant reads of a skill: a task skill's procedure and the
// expertises it consumes, a feature skill's instructions. An MCP prompt is only
// chosen by the user; a resource lets the assistant pick a skill itself. It
// lists only the consumed expertises the company may read, as the prompt does.
function asMarkdown({ doc, version }, readableIds = []) {
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
    body,
    ...(consumed.length
      ? ['', '## Expertises to read first, in this order', '', ...consumed]
      : []),
  ].join('\n');
}

function asResource({ doc }) {
  return {
    uri: uriOf(doc.skillId),
    name: doc.skillId,
    title: doc.title,
    description: doc.description || undefined,
    mimeType: 'text/markdown',
  };
}

function registerSkillResources(server) {
  server.registerResource(
    'skills',
    new ResourceTemplate('lepatron://skills/{skillId}', {
      list: withIdentity(async ({ group }) => ({
        resources: (await servedSkills(group)).map(asResource),
      })),
    }),
    {
      title: 'Badsender skills',
      description:
        'Procedures written by Badsender for an assistant, to run on what the user provides.',
      mimeType: 'text/markdown',
    },
    withIdentity(async ({ group }, uri, { skillId }) => {
      const found = await servedSkill(skillId, group);
      if (!found) throw new ResourceNotFoundError(uri.href);
      const readable = await expertises.consumedExpertises(
        found.version.consumedExpertiseIds,
        group
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

// What an assistant may send, and how many skills it is answered.
const MAX_QUERY_LENGTH = 200;
const MAX_FOUND_SKILLS = 10;

const FIND_INPUT = z.object({
  query: z.string().max(MAX_QUERY_LENGTH).regex(/\S/, 'A query is not blank'),
});
const FIND_OUTPUT = z.object({
  skills: z.array(
    z.object({
      skillId: z.string(),
      title: z.string(),
      description: z.string(),
      nature: z.enum(SkillNatureValues),
      uri: z.string(),
    })
  ),
});

// Every word of the query, in the title or the description, whatever the case.
function matching(query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return ({ doc }) => {
    const haystack = `${doc.title} ${doc.description || ''}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  };
}

function registerFindSkills(server) {
  server.registerTool(
    'find_skills',
    {
      title: 'Find a Badsender skill',
      description: `Finds the Badsender skills whose title or description match what the user wants to do, ${MAX_FOUND_SKILLS} at most. Read the one that fits through its resource URI, then follow it.`,
      inputSchema: FIND_INPUT,
      outputSchema: FIND_OUTPUT,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withIdentity(async ({ group }, { query }) => {
      const skills = (await servedSkills(group))
        .filter(matching(query))
        .slice(0, MAX_FOUND_SKILLS)
        .map(({ doc, version }) => ({
          skillId: doc.skillId,
          title: doc.title,
          description: doc.description || '',
          nature: natureOf(version),
          uri: uriOf(doc.skillId),
        }));
      return {
        content: [{ type: 'text', text: JSON.stringify({ skills }) }],
        structuredContent: { skills },
      };
    })
  );
}

module.exports = { registerSkillResources, registerFindSkills };
