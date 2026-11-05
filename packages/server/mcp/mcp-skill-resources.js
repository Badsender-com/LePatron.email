'use strict';

const { z } = require('zod');
const {
  ResourceTemplate,
  ResourceNotFoundError,
} = require('@modelcontextprotocol/server');
const { withIdentity } = require('./mcp-identity.js');
const {
  uriOf,
  natureOf,
  isTask,
  versionOf,
  servedSkills,
  servedSkill,
  usesExpertise,
  EXPERTISE_NOTICE,
} = require('./mcp-skill-catalog.js');
const expertises = require('./mcp-expertises.js');

// What an assistant reads of a skill: a task skill's procedure and the
// expertises it consumes, a feature skill's instructions. An MCP prompt is only
// chosen by the user; a resource lets the assistant pick a skill itself. It
// lists only the consumed expertises the group may read, as the prompt does.
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
    `Version ${versionOf(version)}.`,
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
      const consumedIds = found.version.consumedExpertiseIds || [];
      const readable = await Promise.all(
        consumedIds.map((id) => expertises.readableExpertise(id, group))
      );
      const readableIds = consumedIds.filter((_id, index) => readable[index]);
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

const SKILL = z.object({
  skillId: z.string(),
  title: z.string(),
  description: z.string(),
  nature: z.string(),
  uri: z.string(),
});

// Every word of the query, in the title or the description, whatever the case.
function matching(query) {
  const words = String(query).toLowerCase().split(/\s+/).filter(Boolean);
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
      description:
        'Finds the Badsender skills whose title or description match what the user wants to do. Read the one that fits through its resource URI, then follow it.',
      inputSchema: z.object({ query: z.string().min(1) }),
      outputSchema: z.object({ skills: z.array(SKILL) }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withIdentity(async ({ group }, { query }) => {
      const skills = (await servedSkills(group))
        .filter(matching(query))
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
