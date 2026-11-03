'use strict';

const { z } = require('zod');
const {
  ResourceTemplate,
  ResourceNotFoundError,
} = require('@modelcontextprotocol/server');
const { Expertises } = require('../common/models.common.js');
const {
  applicableConditions,
} = require('../ai-skill/repositories/expertise.repository.js');
const {
  SkillCategoryValues,
} = require('../ai-skill/constant/skill-constants.js');
const { resolveIdentity } = require('./mcp-identity.js');
const { audienceFilter } = require('./mcp-audience.js');
const {
  servedStatuses,
  servedVersion,
  draftNotice,
} = require('./mcp-drafts.js');

const URI_TEMPLATE = 'lepatron://expertises/{expertiseId}';
const uriOf = (expertiseId) => `lepatron://expertises/${expertiseId}`;
const versionOf = (version) =>
  `${version.versionMajor}.${version.versionMinor}`;

// The active version of an active expertise: what leaves LePatron (ADR 0012).
// Drafts and archives never do, nor an expertise without an active version,
// but in a super admin's drafts mode, where the latest draft does (#1385).
// `conditions` narrows them, as `applicableConditions` writes them.
async function servedExpertises(group, drafts = false, conditions = []) {
  const docs = await Expertises.find({
    status: servedStatuses(drafts),
    ...audienceFilter(group),
    ...(conditions.length && { $and: conditions }),
  }).lean();
  return docs
    .map((doc) => servedVersion(doc, drafts))
    .filter(Boolean)
    .sort((a, b) => a.doc.expertiseId.localeCompare(b.doc.expertiseId));
}

function asResource({ doc, version, draft }) {
  return {
    uri: uriOf(doc.expertiseId),
    name: doc.expertiseId,
    title: draft ? `${doc.title} (draft ${versionOf(version)})` : doc.title,
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
function asMarkdown(found) {
  const { doc, version } = found;
  const updated = new Date(version.updatedAt).toISOString().slice(0, 10);
  const notice = draftNotice(found);
  return [
    `# ${doc.title}`,
    '',
    `Version ${versionOf(version)}, updated on ${updated}.`,
    '',
    ...(notice ? [notice, ''] : []),
    version.body,
    '',
    ...bulleted('Good examples', version.examplesGood),
    ...bulleted('Bad examples', version.examplesBad),
  ]
    .join('\n')
    .trim();
}

// The version of an expertise the group may read it at, or null.
async function readableExpertise(expertiseId, group, drafts = false) {
  return servedVersion(
    await Expertises.findOne({
      expertiseId: String(expertiseId),
      ...audienceFilter(group),
    }).lean(),
    drafts
  );
}

function registerExpertiseResources(server) {
  server.registerResource(
    'expertises',
    new ResourceTemplate(URI_TEMPLATE, {
      list: async (ctx) => {
        const { group, drafts } = await resolveIdentity(ctx.http?.authInfo);
        return {
          resources: (await servedExpertises(group, drafts)).map(asResource),
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
      const { group, drafts } = await resolveIdentity(ctx.http?.authInfo);
      const found = await readableExpertise(expertiseId, group, drafts);
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
  draft: z.boolean().optional(),
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
      const { group, drafts } = await resolveIdentity(ctx.http?.authInfo);
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
      // The features' own conditions, on what this group is served: the
      // active versions, or in drafts mode the drafts, never published ones
      // included. Transversal first, as the features compose them.
      const served = await servedExpertises(
        group,
        drafts,
        applicableConditions({ scope: scopes, categories, emailType, language })
      );
      const expertises = served
        .sort(
          (a, b) =>
            Number(!!b.doc.isTransversal) - Number(!!a.doc.isTransversal) ||
            a.doc.expertiseId.localeCompare(b.doc.expertiseId)
        )
        .map(({ doc, version, draft }) => ({
          expertiseId: doc.expertiseId,
          title: doc.title,
          version: versionOf(version),
          ...(draft && { draft: true }),
          uri: uriOf(doc.expertiseId),
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
  readableExpertise,
  asMarkdown,
  uriOf,
};
