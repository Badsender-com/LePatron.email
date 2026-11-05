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
  findPublished,
} = require('../ai-skill/repositories/published.repository.js');
const { versionLabel } = require('../ai-skill/services/version-helpers.js');
const {
  SkillCategoryValues,
} = require('../ai-skill/constant/skill-constants.js');
const { withIdentity } = require('./mcp-identity.js');
const { audienceFilter } = require('../ai-skill/services/audience.js');

const URI_TEMPLATE = 'lepatron://expertises/{expertiseId}';
const uriOf = (expertiseId) => `lepatron://expertises/${expertiseId}`;

// What each read keeps of an expertise and of its active version.
const LISTED = {
  doc: ['expertiseId', 'title', 'description'],
  version: ['updatedAt'],
};
const READ = {
  doc: ['expertiseId', 'title'],
  version: ['updatedAt', 'body', 'examplesGood', 'examplesBad'],
};
const NAMED = { doc: ['expertiseId'], version: [] };

const byExpertiseId = (a, b) =>
  a.doc.expertiseId.localeCompare(b.doc.expertiseId);

async function publishedExpertises(group) {
  const found = await findPublished(Expertises, audienceFilter(group), LISTED);
  return found.sort(byExpertiseId);
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
    `Version ${versionLabel(version)}, updated on ${updated}.`,
    '',
    version.body,
    '',
    ...bulleted('Good examples', version.examplesGood),
    ...bulleted('Bad examples', version.examplesBad),
  ]
    .join('\n')
    .trim();
}

// The active version of an expertise the company may read, or null.
async function readableExpertise(expertiseId, group) {
  const [found] = await findPublished(
    Expertises,
    { expertiseId: String(expertiseId), ...audienceFilter(group) },
    READ
  );
  return found || null;
}

/**
 * The expertises a task skill consumes that the company may read, in the
 * skill's order, in one read: those not published, or not for this company,
 * are left out.
 *
 * @param {string[]} [ids] the skill version's `consumedExpertiseIds`
 * @param {Object} group the company of the caller
 * @param {Object} [options]
 * @param {boolean} [options.content] read their content, not only their ids
 * @returns {Promise<Array<{ doc: Object, version: Object }>>}
 */
async function consumedExpertises(ids = [], group, { content = false } = {}) {
  const wanted = [...new Set(ids.map(String))];
  if (!wanted.length) return [];
  const found = await findPublished(
    Expertises,
    { expertiseId: { $in: wanted }, ...audienceFilter(group) },
    content ? READ : NAMED
  );
  const byId = new Map(found.map((item) => [item.doc.expertiseId, item]));
  return wanted.map((id) => byId.get(id)).filter(Boolean);
}

function registerExpertiseResources(server) {
  server.registerResource(
    'expertises',
    new ResourceTemplate(URI_TEMPLATE, {
      list: withIdentity(async ({ group }) => ({
        resources: (await publishedExpertises(group)).map(asResource),
      })),
    }),
    {
      title: 'Badsender expertises',
      description:
        'The email expertise of Badsender, one Markdown document per topic, in its active version.',
      mimeType: 'text/markdown',
    },
    withIdentity(async ({ group }, uri, { expertiseId }) => {
      const found = await readableExpertise(expertiseId, group);
      if (!found) throw new ResourceNotFoundError(uri.href);
      return {
        contents: [
          { uri: uri.href, mimeType: 'text/markdown', text: asMarkdown(found) },
        ],
      };
    })
  );
}

const FIND_INPUT = z.object({
  scope: z.union([z.string(), z.array(z.string())]).optional(),
  categories: z.array(z.enum(SkillCategoryValues)).optional(),
  emailType: z.string().optional(),
  language: z.string().optional(),
});
const FIND_OUTPUT = z.object({
  expertises: z.array(
    z.object({
      expertiseId: z.string(),
      title: z.string(),
      version: z.string(),
      uri: z.string(),
    })
  ),
});

function registerFindApplicableExpertises(server) {
  server.registerTool(
    'find_applicable_expertises',
    {
      title: 'Find the expertises that apply',
      description:
        'Finds the Badsender expertises that apply to a piece of an email: a scope (e.g. "subject", "cta"), one or more categories, and optionally an email type and a language. Read each one through its resource URI.',
      inputSchema: FIND_INPUT,
      outputSchema: FIND_OUTPUT,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withIdentity(
      async ({ group }, { scope, categories, emailType, language }) => {
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
        // The features' own lookup, with the audience of the caller's company.
        const found = await findApplicable({
          scope: scopes,
          categories,
          emailType,
          language,
          group,
        });
        const expertises = found.map((expertise) => ({
          expertiseId: expertise.expertiseId,
          title: expertise.title,
          version: versionLabel(expertise),
          uri: uriOf(expertise.expertiseId),
        }));
        return {
          content: [{ type: 'text', text: JSON.stringify({ expertises }) }],
          structuredContent: { expertises },
        };
      }
    )
  );
}

module.exports = {
  registerExpertiseResources,
  registerFindApplicableExpertises,
  consumedExpertises,
  asMarkdown,
  uriOf,
};
