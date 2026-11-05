'use strict';

const {
  ResourceTemplate,
  ResourceNotFoundError,
} = require('@modelcontextprotocol/server');
const { Expertises } = require('../common/models.common.js');
const {
  findPublished,
} = require('../ai-skill/repositories/published.repository.js');
const { versionLabel } = require('../ai-skill/services/version-helpers.js');
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
      title: 'Expertises',
      description:
        'Email know-how, one Markdown document per topic, in its active version.',
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

module.exports = {
  registerExpertiseResources,
  consumedExpertises,
  asMarkdown,
  uriOf,
};
