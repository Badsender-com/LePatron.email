'use strict';

const { z } = require('zod');
const { findMailingsByWords } = require('../mailing/mailing-search.service.js');
const { siteOrigin } = require('../email-templates/email-template.js');
const { versionLabel } = require('../ai-skill/services/version-helpers.js');
const { containingRegExp } = require('../utils/text-search.js');
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
const MAX_ID_LENGTH = 200;

// A few words, as a person types them; the search tries each one in every
// field it covers.
const MAX_QUERY_LENGTH = 200;
const MAX_WORDS = 10;

// The kinds of result, the first part of their id.
const MAILING_KIND = 'mailing';
const EXPERTISE_KIND = 'expertise';

const editorUrlOf = (mailingId) => `${siteOrigin()}/editor/${mailingId}`;

const queryWords = (query) =>
  String(query).split(/\s+/).filter(Boolean).slice(0, MAX_WORDS);

// What an expertise is searched by: its title, its description and the
// headings of its sections.
function describes({ doc, version }) {
  const headings = String(version.body || '')
    .split('\n')
    .filter((line) => /^#+\s/.test(line))
    .join(' ');
  return `${doc.title} ${doc.description || ''} ${headings}`;
}

// What a search answers when the database took too long (ADR 0007).
const isTimeout = (error) => error && error.status === 503;

async function search({ user, group, drafts }, { query }) {
  const words = queryWords(query);
  if (words.length === 0) return answered({ results: [] });
  let found;
  try {
    found = await Promise.all([
      findMailingsByWords(user, words, MAX_MAILINGS),
      expertises.searchableExpertises(group, drafts),
    ]);
  } catch (error) {
    if (!isTimeout(error)) throw error;
    return failure(
      'The search took too long: try again with more precise words.'
    );
  }
  const [mailings, served] = found;
  const patterns = words.map(containingRegExp);
  const results = [
    ...mailings.map((mailing) => ({
      id: `${MAILING_KIND}:${mailing._id}`,
      title: mailing.name,
      url: editorUrlOf(mailing._id),
    })),
    ...served
      .filter((expertise) =>
        patterns.every((pattern) => pattern.test(describes(expertise)))
      )
      .map(({ doc }) => ({
        id: `${EXPERTISE_KIND}:${doc.expertiseId}`,
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
  if (kind === MAILING_KIND && key) {
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
  if (kind === EXPERTISE_KIND && key) {
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
    return failure(
      'Not found: no such document, or this user may not read it.'
    );
  }
  return answered(document);
}

const failure = (text) => ({
  isError: true,
  content: [{ type: 'text', text }],
});

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
        'Searches the mailings the user may read, by words of their name, subject, tags or email type (not their content), and the expertises, by words of their title or section headings. Every word must match, whatever its case and accents; a word may be a part of a longer one. The expertises are written in French: search them with French words. Read a result with fetch.',
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
