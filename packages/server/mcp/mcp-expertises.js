'use strict';

const { z } = require('zod');
const {
  ResourceTemplate,
  ResourceNotFoundError,
} = require('@modelcontextprotocol/server');
const { Expertises } = require('../common/models.common.js');
const {
  findApplicable,
} = require('../ai-skill/repositories/expertise.repository.js');
const {
  findActiveVersion,
} = require('../ai-skill/services/version-helpers.js');
const {
  SkillStatuses,
  SkillCategoryValues,
} = require('../ai-skill/constant/skill-constants.js');
const { resolveIdentity } = require('./mcp-identity.js');
const { audienceFilter } = require('./mcp-audience.js');

const URI_TEMPLATE = 'lepatron://expertises/{expertiseId}';
const uriOf = (expertiseId) => `lepatron://expertises/${expertiseId}`;
const versionOf = (version) =>
  `${version.versionMajor}.${version.versionMinor}`;

// The active version of an active expertise: what leaves LePatron (ADR 0012).
// Drafts and archives never do, nor an expertise without an active version.
function published(doc) {
  if (!doc || doc.status !== SkillStatuses.ACTIVE) return null;
  const version = findActiveVersion(doc);
  if (!version || version.status !== SkillStatuses.ACTIVE) return null;
  return { doc, version };
}

async function publishedExpertises(group) {
  const docs = await Expertises.find({
    status: SkillStatuses.ACTIVE,
    ...audienceFilter(group),
  }).lean();
  return docs
    .map(published)
    .filter(Boolean)
    .sort((a, b) => a.doc.expertiseId.localeCompare(b.doc.expertiseId));
}

function asResource({ doc, version }) {
  return {
    uri: uriOf(doc.expertiseId),
    name: doc.expertiseId,
    title: doc.title,
    description: doc.description || undefined,
    mimeType: 'text/markdown',
    annotations: { lastModified: new Date(version.updatedAt).toISOString() },
  };
}

function bulleted(title, examples) {
  if (!examples || !examples.length) return [];
  return [`## ${title}`, '', ...examples.map((example) => `- ${example}`), ''];
}

// One Markdown document: the expertise, its version, its examples.
function asMarkdown({ doc, version }) {
  const updated = new Date(version.updatedAt).toISOString().slice(0, 10);
  return [
    `# ${doc.title}`,
    '',
    `Version ${versionOf(version)}, updated on ${updated}.`,
    '',
    version.body,
    '',
    ...bulleted('Good examples', version.examplesGood),
    ...bulleted('Bad examples', version.examplesBad),
  ]
    .join('\n')
    .trim();
}

function registerExpertiseResources(server) {
  server.registerResource(
    'expertises',
    new ResourceTemplate(URI_TEMPLATE, {
      list: async (ctx) => {
        const { group } = await resolveIdentity(ctx.http?.authInfo);
        return {
          resources: (await publishedExpertises(group)).map(asResource),
        };
      },
    }),
    {
      title: 'Badsender expertises',
      description:
        'The email expertise of Badsender, one Markdown document per topic, in its active version.',
      mimeType: 'text/markdown',
    },
    async (uri, { expertiseId }, ctx) => {
      const { group } = await resolveIdentity(ctx.http?.authInfo);
      const found = published(
        await Expertises.findOne({
          expertiseId: String(expertiseId),
          ...audienceFilter(group),
        }).lean()
      );
      if (!found) throw new ResourceNotFoundError(uri.href);
      return {
        contents: [
          { uri: uri.href, mimeType: 'text/markdown', text: asMarkdown(found) },
        ],
      };
    }
  );
}

const EXPERTISE = z.object({
  expertiseId: z.string(),
  title: z.string(),
  version: z.string(),
  uri: z.string(),
});

function registerFindApplicableExpertises(server) {
  server.registerTool(
    'find_applicable_expertises',
    {
      title: 'Find the expertises that apply',
      description:
        'Finds the Badsender expertises that apply to a piece of an email: a scope (e.g. "subject", "cta"), one or more categories, and optionally an email type and a language. Read each one through its resource URI.',
      inputSchema: z.object({
        scope: z.union([z.string(), z.array(z.string())]).optional(),
        categories: z.array(z.enum(SkillCategoryValues)).optional(),
        emailType: z.string().optional(),
        language: z.string().optional(),
      }),
      outputSchema: z.object({ expertises: z.array(EXPERTISE) }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ scope, categories, emailType, language }, ctx) => {
      const { group } = await resolveIdentity(ctx.http?.authInfo);
      const scopes = [].concat(scope || []).filter(Boolean);
      if (!scopes.length || !categories || !categories.length) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text:
                'Give a scope and at least one category: the expertises are written for a precise part of an email.',
            },
          ],
        };
      }
      const found = await findApplicable({
        scope: scopes,
        categories,
        emailType,
        language,
      });
      // The lookup is the features' own, which knows no audience: what the
      // group may not read is dropped from what it found.
      const readable = new Set(
        (await publishedExpertises(group)).map(({ doc }) => doc.expertiseId)
      );
      const expertises = found
        .filter((expertise) => readable.has(expertise.expertiseId))
        .map((expertise) => ({
          expertiseId: expertise.expertiseId,
          title: expertise.title,
          version: versionOf(expertise),
          uri: uriOf(expertise.expertiseId),
        }));
      return {
        content: [{ type: 'text', text: JSON.stringify({ expertises }) }],
        structuredContent: { expertises },
      };
    }
  );
}

module.exports = {
  registerExpertiseResources,
  registerFindApplicableExpertises,
};
