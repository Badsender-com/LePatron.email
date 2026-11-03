'use strict';

const { z } = require('zod');
const { searchMailings } = require('../mailing/mailing-search.service.js');
const { siteOrigin } = require('../email-templates/email-template.js');
const { versionLabel } = require('../ai-skill/services/version-helpers.js');
const { withIdentity } = require('./mcp-identity.js');
const { mailingOf, asPlainText } = require('./mcp-mailing-read.js');
const expertises = require('./mcp-expertises.js');

// `search` and `fetch` in the shape ChatGPT expects for deep research and
// company knowledge (ADR 0012): a result is an id, a title and a URL, and
// `fetch` reads one back. Over the mailings the user may read, by what
// describes them, and the expertises served, by their title and sections.

// Enough for an assistant to pick from; it narrows its words otherwise.
const MAX_MAILINGS = 20;
// What an assistant may send: bounded, like every input of this server.
const MAX_QUERY_LENGTH = 200;
const MAX_ID_LENGTH = 200;

const MAILING = 'mailing';
const EXPERTISE = 'expertise';

const editorUrlOf = (mailingId) => `${siteOrigin()}/editor/${mailingId}`;

const wordsOf = (query) =>
  String(query).toLowerCase().split(/\s+/).filter(Boolean);

// What an expertise is searched by: its title, its description and the
// headings of its sections.
function describes({ doc, version }) {
  const headings = String(version.body || '')
    .split('\n')
    .filter((line) => /^#+\s/.test(line))
    .join(' ');
  return `${doc.title} ${doc.description || ''} ${headings}`.toLowerCase();
}

async function search({ user, group, drafts }, { query }) {
  const words = wordsOf(query);
  if (words.length === 0) return answered({ results: [] });
  const [{ items }, served] = await Promise.all([
    searchMailings({
      user,
      pagination: { page: 1, itemsPerPage: MAX_MAILINGS },
      within: { words },
    }),
    expertises.searchableExpertises(group, drafts),
  ]);
  const results = [
    ...items.docs.map((mailing) => ({
      id: `${MAILING}:${mailing._id}`,
      title: mailing.name,
      url: editorUrlOf(mailing._id),
    })),
    ...served
      .filter((found) => words.every((word) => describes(found).includes(word)))
      .map(({ doc }) => ({
        id: `${EXPERTISE}:${doc.expertiseId}`,
        title: doc.title,
        url: expertises.uriOf(doc.expertiseId),
      })),
  ];
  return answered({ results });
}

// A search result read back as a document, or null when the user may not
// read it.
async function documentOf(id, identity) {
  const [kind, key] = String(id).split(/:(.*)/s);
  if (kind === MAILING && key) {
    const mailing = await mailingOf(key, identity);
    return (
      mailing && {
        id,
        title: mailing.name,
        text: asPlainText(mailing),
        url: editorUrlOf(mailing.id),
        metadata: {
          status: mailing.status,
          subject: mailing.subject,
          tags: mailing.tags,
          workspace: mailing.workspace.name,
          updatedAt: mailing.updatedAt,
        },
      }
    );
  }
  if (kind === EXPERTISE && key) {
    const found = await expertises.readableExpertise(
      key,
      identity.group,
      identity.drafts
    );
    return (
      found && {
        id,
        title: found.doc.title,
        text: expertises.asMarkdown(found),
        url: expertises.uriOf(found.doc.expertiseId),
        metadata: {
          version: versionLabel(found.version),
          ...(found.draft && { draft: true }),
        },
      }
    );
  }
  return null;
}

async function fetchDocument(identity, { id }) {
  const document = await documentOf(id, identity);
  if (!document) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: 'Not found: no such document, or this user may not read it.',
        },
      ],
    };
  }
  return answered(document);
}

function answered(answer) {
  return {
    content: [{ type: 'text', text: JSON.stringify(answer) }],
    structuredContent: answer,
  };
}

const RESULT = z.object({ id: z.string(), title: z.string(), url: z.string() });
const SEARCH_INPUT = z.object({ query: z.string().max(MAX_QUERY_LENGTH) });
const SEARCH_OUTPUT = z.object({ results: z.array(RESULT) });
const FETCH_INPUT = z.object({ id: z.string().max(MAX_ID_LENGTH) });
const FETCH_OUTPUT = RESULT.extend({
  text: z.string(),
  metadata: z.record(z.string(), z.unknown()),
});

function registerSearchAndFetch(server) {
  server.registerTool(
    'search',
    {
      title: 'Search LePatron',
      description:
        'Searches the mailings the user may read, by words of their name, subject, tags or email type (not their content), and the expertises, by words of their title or section headings. Every word must match. The expertises are written in French: search them with French words. Read a result with fetch.',
      inputSchema: SEARCH_INPUT,
      outputSchema: SEARCH_OUTPUT,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withIdentity(search)
  );
  server.registerTool(
    'fetch',
    {
      title: 'Read a search result',
      description:
        'Reads a result of search by its id: a mailing as text (its facts, then its content), an expertise as Markdown.',
      inputSchema: FETCH_INPUT,
      outputSchema: FETCH_OUTPUT,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withIdentity(fetchDocument)
  );
}

module.exports = { registerSearchAndFetch };
