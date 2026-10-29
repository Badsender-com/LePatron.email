'use strict';

const { z } = require('zod');
const {
  ResourceTemplate,
  ResourceNotFoundError,
} = require('@modelcontextprotocol/server');
const { resolveIdentity } = require('./mcp-identity.js');
const {
  uriOf,
  isTask,
  versionOf,
  servedSkills,
  servedSkill,
} = require('./mcp-skill-catalog.js');
const expertises = require('./mcp-expertises.js');

// What an assistant reads of a skill: a task skill's procedure and the
// expertises it consumes, a feature skill's instructions. An MCP prompt is only
// chosen by the user; a resource lets the assistant pick a skill itself.
function asMarkdown({ doc, version }) {
  const body = isTask(doc)
    ? version.procedure
    : [version.systemPrompt, version.skillBody].filter(Boolean).join('\n\n');
  const consumed = (version.consumedExpertiseIds || []).map(
    (id) => `- ${expertises.uriOf(id)}`
  );
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
      list: async (ctx) => {
        const { group } = await resolveIdentity(ctx.http?.authInfo);
        return { resources: (await servedSkills(group)).map(asResource) };
      },
    }),
    {
      title: 'Badsender skills',
      description:
        'Procedures written by Badsender for an assistant, to run on what the user provides.',
      mimeType: 'text/markdown',
    },
    async (uri, { skillId }, ctx) => {
      const { group } = await resolveIdentity(ctx.http?.authInfo);
      const found = await servedSkill(skillId, group);
      if (!found) throw new ResourceNotFoundError(uri.href);
      return {
        contents: [
          { uri: uri.href, mimeType: 'text/markdown', text: asMarkdown(found) },
        ],
      };
    }
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
    async ({ query }, ctx) => {
      const { group } = await resolveIdentity(ctx.http?.authInfo);
      const skills = (await servedSkills(group))
        .filter(matching(query))
        .map(({ doc }) => ({
          skillId: doc.skillId,
          title: doc.title,
          description: doc.description || '',
          nature: doc.nature || 'feature',
          uri: uriOf(doc.skillId),
        }));
      return {
        content: [{ type: 'text', text: JSON.stringify({ skills }) }],
        structuredContent: { skills },
      };
    }
  );
}

module.exports = { registerSkillResources, registerFindSkills };
