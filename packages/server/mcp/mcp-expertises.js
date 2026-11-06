'use strict';

const {
  ResourceTemplate,
  ResourceNotFoundError,
} = require('@modelcontextprotocol/server');
const { Expertises } = require('../common/models.common.js');
const {
  findServed,
} = require('../ai-skill/repositories/published.repository.js');
const { versionLabel } = require('../ai-skill/services/version-helpers.js');
const { withIdentity } = require('./mcp-identity.js');
const { audienceFilter } = require('../ai-skill/services/audience.js');
const { draftNotice } = require('./mcp-drafts.js');

const URI_TEMPLATE = 'lepatron://expertises/{expertiseId}';
const uriOf = (expertiseId) => `lepatron://expertises/${expertiseId}`;

// What each read keeps of an expertise and of the version it is served at:
// its active version, or in a super admin's drafts mode its open draft
// (#1385).
const LISTED = {
  doc: ['expertiseId', 'title', 'description'],
  version: ['updatedAt'],
};
const READ = {
  doc: ['expertiseId', 'title'],
  version: ['updatedAt', 'body', 'examplesGood', 'examplesBad'],
};
const NAMED = { doc: ['expertiseId'], version: [] };
// What `search` reads of each: what describes it, its sections' headings in
// its body.
const SEARCHED = {
  doc: ['expertiseId', 'title', 'description'],
  version: ['body'],
};

const byExpertiseId = (a, b) =>
  a.doc.expertiseId.localeCompare(b.doc.expertiseId);

async function servedExpertises(group, drafts = false) {
  const found = await findServed(Expertises, audienceFilter(group), LISTED, {
    drafts,
  });
  return found.sort(byExpertiseId);
}

/**
 * The expertises a company is served, with what describes them, for the
 * `search` tool (mcp-search.js).
 *
 * @param {Object} group
 * @param {boolean} [drafts]
 * @returns {Promise<Array<{ doc: Object, version: Object, draft: boolean }>>}
 */
async function searchableExpertises(group, drafts = false) {
  const found = await findServed(Expertises, audienceFilter(group), SEARCHED, {
    drafts,
  });
  return found.sort(byExpertiseId);
}

function asResource({ doc, version, draft }) {
  return {
    uri: uriOf(doc.expertiseId),
    name: doc.expertiseId,
    title: draft ? `${doc.title} (draft ${versionLabel(version)})` : doc.title,
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
    `Version ${versionLabel(version)}, updated on ${updated}.`,
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

// The version of an expertise the company may read it at, or null.
async function readableExpertise(expertiseId, group, drafts = false) {
  const [found] = await findServed(
    Expertises,
    { expertiseId: String(expertiseId), ...audienceFilter(group) },
    READ,
    { drafts }
  );
  return found || null;
}

/**
 * The expertises a task skill consumes that the company may read, in the
 * skill's order, in one read: those not published, or not for this company,
 * are left out. In drafts mode, each is read at its open draft (#1385).
 *
 * @param {string[]} [ids] the skill version's `consumedExpertiseIds`
 * @param {Object} group the company of the caller
 * @param {Object} [options]
 * @param {boolean} [options.content] read their content, not only their ids
 * @param {boolean} [options.drafts] at their open draft, in drafts mode
 * @returns {Promise<Array<{ doc: Object, version: Object, draft: boolean }>>}
 */
async function consumedExpertises(
  ids = [],
  group,
  { content = false, drafts = false } = {}
) {
  const wanted = [...new Set(ids.map(String))];
  if (!wanted.length) return [];
  const found = await findServed(
    Expertises,
    { expertiseId: { $in: wanted }, ...audienceFilter(group) },
    content ? READ : NAMED,
    { drafts }
  );
  const byId = new Map(found.map((item) => [item.doc.expertiseId, item]));
  return wanted.map((id) => byId.get(id)).filter(Boolean);
}

function registerExpertiseResources(server) {
  server.registerResource(
    'expertises',
    new ResourceTemplate(URI_TEMPLATE, {
      list: withIdentity(async ({ group, drafts }) => ({
        resources: (await servedExpertises(group, drafts)).map(asResource),
      })),
    }),
    {
      title: 'Expertises',
      description:
        'Email know-how, one Markdown document per topic, in its active version.',
      mimeType: 'text/markdown',
    },
    withIdentity(async ({ group, drafts }, uri, { expertiseId }) => {
      const found = await readableExpertise(expertiseId, group, drafts);
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
  searchableExpertises,
  readableExpertise,
  consumedExpertises,
  asMarkdown,
  uriOf,
};
