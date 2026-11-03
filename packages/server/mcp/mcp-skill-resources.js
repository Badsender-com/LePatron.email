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
  usesExpertise,
  EXPERTISE_NOTICE,
} = require('./mcp-skill-catalog.js');
const expertises = require('./mcp-expertises.js');
const { draftNotice } = require('./mcp-drafts.js');

// What an assistant reads of a skill: a task skill's procedure and the
// expertises it consumes, a feature skill's instructions. An MCP prompt is only
// chosen by the user; a resource lets the assistant pick a skill itself. It
// lists only the consumed expertises the group may read, as the prompt does.
function asMarkdown(found, readableIds = []) {
  const { doc, version } = found;
  const notice = draftNotice(found);
  const body = isTask(doc)
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
    title: draft ? `${doc.title} (draft ${versionOf(version)})` : doc.title,
    description: doc.description || undefined,
    mimeType: 'text/markdown',
  };
}

function registerSkillResources(server) {
  server.registerResource(
    'skills',
    new ResourceTemplate('lepatron://skills/{skillId}', {
      list: async (ctx) => {
        const { group, drafts } = await resolveIdentity(ctx.http?.authInfo);
        return {
          resources: (await servedSkills(group, drafts)).map(asResource),
        };
      },
    }),
    {
      title: 'Badsender skills',
      description:
        'Procedures written by Badsender for an assistant, to run on what the user provides.',
      mimeType: 'text/markdown',
    },
    async (uri, { skillId }, ctx) => {
      const { group, drafts } = await resolveIdentity(ctx.http?.authInfo);
      const found = await servedSkill(skillId, group, drafts);
      if (!found) throw new ResourceNotFoundError(uri.href);
      const consumedIds = found.version.consumedExpertiseIds || [];
      const readable = await Promise.all(
        consumedIds.map((id) => expertises.readableExpertise(id, group, drafts))
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
    }
  );
}

const SKILL = z.object({
  skillId: z.string(),
  title: z.string(),
  description: z.string(),
  nature: z.string(),
  draft: z.boolean().optional(),
  uri: z.string(),
});

// Every word of the query, in the identifier, the title or the description,
// whatever the case.
function matching(query) {
  const words = String(query).toLowerCase().split(/\s+/).filter(Boolean);
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
      title: 'Find a Badsender skill',
      description:
        'Finds the Badsender skills whose identifier, title or description match what the user wants to do. They are written in French: search with French words. When nothing matches, or without a query, every skill is listed (matched is false then): pick by their descriptions. Read the one that fits through its resource URI, then follow it.',
      inputSchema: z.object({ query: z.string().optional() }),
      outputSchema: z.object({
        skills: z.array(SKILL),
        matched: z.boolean(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ query }, ctx) => {
      const { group, drafts } = await resolveIdentity(ctx.http?.authInfo);
      const served = await servedSkills(group, drafts);
      // Words of another language than the skills' match nothing: the whole
      // list is then answered, for the assistant to choose from (it is short).
      const found = String(query || '').trim()
        ? served.filter(matching(query))
        : [];
      const matched = found.length > 0;
      const skills = (matched ? found : served).map(({ doc, draft }) => ({
        skillId: doc.skillId,
        title: doc.title,
        description: doc.description || '',
        nature: doc.nature || 'feature',
        ...(draft && { draft: true }),
        uri: uriOf(doc.skillId),
      }));
      const answer = { skills, matched };
      return {
        content: [{ type: 'text', text: JSON.stringify(answer) }],
        structuredContent: answer,
      };
    }
  );
}

module.exports = { registerSkillResources, registerFindSkills };
