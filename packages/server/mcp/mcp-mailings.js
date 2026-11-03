'use strict';

const { z } = require('zod');
const {
  ResourceTemplate,
  ResourceNotFoundError,
} = require('@modelcontextprotocol/server');
const { Mailings } = require('../common/models.common.js');
const {
  searchMailings,
  accessibleLocations,
  locateReadableMailing,
} = require('../mailing/mailing-search.service.js');
const { sanitizePreviewCached } = require('../mailing/mailing.service.js');
const { withIdentity, failure } = require('./mcp-identity.js');
const {
  MAILING_STATUSES,
  approvedMailingIds,
  statusOf,
} = require('./mcp-mailing-status.js');
const { mailingText, variablesOf } = require('./mcp-mailing-text.js');

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;
// What an assistant may send: bounded, like every input of this server.
const MAX_NAME_LENGTH = 200;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 100;
const MAX_LOCATIONS = 50;
const MAX_ID_LENGTH = 100;

const uriOf = (mailingId) => `lepatron://mailings/${mailingId}`;

// The ESP profiles a mailing was pushed to, each counted once.
const espProfileCountOf = (espIds) =>
  new Set((espIds || []).map((push) => String(push.profileId))).size;

// What the listing leaves out and the status needs: one query for the page.
async function factsOf(mailingIds) {
  const [mailings, approved] = await Promise.all([
    Mailings.find({ _id: { $in: mailingIds } })
      .select('subject plannedSendDate')
      .lean(),
    approvedMailingIds(mailingIds),
  ]);
  const byId = new Map(
    mailings.map((mailing) => [String(mailing._id), mailing])
  );
  return (id) => ({
    ...byId.get(id),
    approved: approved.has(id),
  });
}

const REFERENCE = z.object({ id: z.string(), name: z.string() });
const MAILING = z.object({
  id: z.string(),
  name: z.string(),
  subject: z.string().nullable(),
  tags: z.array(z.string()),
  status: z.enum(MAILING_STATUSES),
  approved: z.boolean(),
  plannedSendDate: z.string().nullable(),
  espProfileCount: z.number(),
  author: z.string().nullable(),
  template: z.string().nullable(),
  workspace: REFERENCE,
  folder: REFERENCE.optional(),
  subfolder: REFERENCE.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  uri: z.string(),
});

const isoOf = (date) => (date ? new Date(date).toISOString() : null);

function asItem(mailing, facts, now) {
  const espProfileCount = espProfileCountOf(mailing.espIds);
  return {
    id: String(mailing._id),
    name: mailing.name,
    subject: facts.subject || null,
    tags: mailing.tags || [],
    status: statusOf(
      {
        espProfileCount,
        approved: facts.approved,
        plannedSendDate: facts.plannedSendDate,
      },
      now
    ),
    approved: facts.approved,
    plannedSendDate: isoOf(facts.plannedSendDate),
    espProfileCount,
    // The search answers the author's and the template's names under the
    // listing's own names.
    author: mailing.userName || null,
    template: mailing.templateName || null,
    ...mailing.location,
    createdAt: isoOf(mailing.createdAt),
    updatedAt: isoOf(mailing.updatedAt),
    uri: uriOf(mailing._id),
  };
}

/**
 * The mailings a user may read in the company the token is bound to (ADR 0012),
 * answered by the search across accessible workspaces (ADR 0007): the same
 * rule decides what comes back in the app and in an assistant. Each one with
 * its derived status, and linked as a resource.
 */
async function listMailings({ user }, args) {
  const pageSize = args.pageSize ?? DEFAULT_PAGE_SIZE;
  if (pageSize > MAX_PAGE_SIZE) {
    return failure(
      `A page holds ${MAX_PAGE_SIZE} mailings at most: ask for the next page.`
    );
  }
  const { items } = await searchMailings({
    user,
    filters: {
      name: args.name,
      tags: args.tags,
      createdAtStart: args.createdAfter,
      createdAtEnd: args.createdBefore,
      updatedAtStart: args.updatedAfter,
      updatedAtEnd: args.updatedBefore,
    },
    pagination: { page: args.page ?? 1, itemsPerPage: pageSize },
    within: {
      workspaceIds: args.workspaceIds,
      folderIds: args.folderIds,
      ...(args.mine && { userIds: [user.id] }),
      authorName: args.author,
    },
  });
  const factsFor = await factsOf(items.docs.map((mailing) => mailing._id));
  const now = new Date();
  const mailings = items.docs.map((mailing) =>
    asItem(mailing, factsFor(String(mailing._id)), now)
  );
  const answer = {
    mailings,
    total: items.totalDocs,
    page: items.page,
    pageSize,
    totalPages: items.totalPages,
  };
  return {
    content: [
      { type: 'text', text: JSON.stringify(answer) },
      ...mailings.map((mailing) => ({
        type: 'resource_link',
        uri: mailing.uri,
        name: mailing.name,
        mimeType: 'text/plain',
      })),
    ],
    structuredContent: answer,
  };
}

const DATE = z.string().datetime({ offset: true });
const LOCATION_IDS = z.array(z.string().max(MAX_ID_LENGTH)).max(MAX_LOCATIONS);
const LIST_INPUT = z.object({
  name: z.string().max(MAX_NAME_LENGTH).optional(),
  tags: z.array(z.string().max(MAX_TAG_LENGTH)).max(MAX_TAGS).optional(),
  workspaceIds: LOCATION_IDS.optional(),
  folderIds: LOCATION_IDS.optional(),
  mine: z.boolean().optional(),
  author: z.string().max(MAX_NAME_LENGTH).optional(),
  createdAfter: DATE.optional(),
  createdBefore: DATE.optional(),
  updatedAfter: DATE.optional(),
  updatedBefore: DATE.optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).optional(),
});
const LIST_OUTPUT = z.object({
  mailings: z.array(MAILING),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
});

function registerListMailings(server) {
  server.registerTool(
    'list_mailings',
    {
      title: 'List the mailings',
      description:
        "Lists the mailings the user may read in LePatron, in the company of this connection, the most recently updated first, a page at a time. Filters: a part of the name, tags, creation and update dates, workspaces and folders (a folder with its subfolders; list_workspaces gives their ids), the user's own mailings (mine) or a part of the author's name. A mailing with no folder sits at the root of its workspace. Each one comes with its status, derived from its facts: pushed-to-esp (a campaign or template was created in an ESP; it says nothing of sending), scheduled (approved, planned in the future), approved, or draft. LePatron never knows whether a mailing was sent. Read a mailing's content through its resource URI.",
      inputSchema: LIST_INPUT,
      outputSchema: LIST_OUTPUT,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withIdentity(listMailings)
  );
}

const FOLDER = REFERENCE.extend({ subfolders: z.array(REFERENCE) });
const WORKSPACE = REFERENCE.extend({ folders: z.array(FOLDER) });
const WORKSPACES_INPUT = z.object({});
const WORKSPACES_OUTPUT = z.object({ workspaces: z.array(WORKSPACE) });

function registerListWorkspaces(server) {
  server.registerTool(
    'list_workspaces',
    {
      title: 'List the workspaces',
      description:
        'Lists the workspaces the user may read in LePatron, in the company of this connection, each with its folders and their subfolders: where mailings are filed. Give their ids to list_mailings to look in some of them only.',
      inputSchema: WORKSPACES_INPUT,
      outputSchema: WORKSPACES_OUTPUT,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withIdentity(async ({ user }) => {
      const answer = { workspaces: await accessibleLocations(user) };
      return {
        content: [{ type: 'text', text: JSON.stringify(answer) }],
        structuredContent: answer,
      };
    })
  );
}

const MAILING_NOT_FOUND =
  'Mailing not found: it does not exist, or this user may not read it.';

const FORMATS = ['text', 'html'];

/**
 * One mailing the user may read (ADR 0012): its facts and derived status, and
 * its content, read from the sanitised preview the app serves: its text by
 * default, its HTML on request. A mailing never saved in the editor has no
 * preview, so no content.
 *
 * @returns {Promise<Object|null>} null when the user may not read it
 */
async function mailingOf(mailingId, { user }, format = 'text') {
  // The search's rule (ADR 0007, 0012): what list_mailings would never find
  // is never read.
  const found = await locateReadableMailing(user, mailingId, '-data');
  if (!found) return null;
  const { mailing, location } = found;
  const approved = (await approvedMailingIds([mailing._id])).has(
    String(mailing._id)
  );
  const facts = asItem(
    {
      ...mailing,
      // The names the search answers under, copied on the mailing.
      userName: mailing.author,
      templateName: mailing.wireframe,
      location,
    },
    { ...mailing, approved },
    new Date()
  );
  const html = mailing.previewHtml ? sanitizePreviewCached(mailing) : null;
  if (format === 'html') {
    return { ...facts, html, variables: html ? variablesOf(html) : [] };
  }
  const text = html ? mailingText(mailing, html) : null;
  return { ...facts, text, variables: text ? variablesOf(text) : [] };
}

const GET_INPUT = z.object({
  mailingId: z.string().max(MAX_ID_LENGTH),
  format: z.enum(FORMATS).optional(),
});
const GET_OUTPUT = MAILING.extend({
  text: z.string().nullable().optional(),
  html: z.string().nullable().optional(),
  variables: z.array(z.string()),
});

function registerGetMailing(server) {
  server.registerTool(
    'get_mailing',
    {
      title: 'Read a mailing',
      description:
        'Reads one mailing the user may read in LePatron: its facts and status, as list_mailings gives them, and its content. By default its text, in reading order: subject, preheader, headings after #, paragraphs, links as [label](href), images by their alternative text. With format html, its HTML instead, as the app previews it. Personalization variables ({{firstname}}, %%FIRSTNAME%%, [[firstname]]) are kept where they stand and listed in variables: never fill them in. A mailing never saved in the editor has no content (null).',
      inputSchema: GET_INPUT,
      outputSchema: GET_OUTPUT,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withIdentity(async (identity, { mailingId, format }) => {
      const answer = await mailingOf(mailingId, identity, format);
      if (!answer) return failure(MAILING_NOT_FOUND);
      return {
        content: [{ type: 'text', text: JSON.stringify(answer) }],
        structuredContent: answer,
      };
    })
  );
}

// The resource a listing links to: the mailing's facts, then its text.
function asPlainText(mailing) {
  const where = [mailing.workspace, mailing.folder, mailing.subfolder]
    .filter(Boolean)
    .map(({ name }) => name)
    .join(' / ');
  return [
    `# ${mailing.name}`,
    '',
    `Status: ${mailing.status}. In ${where}.`,
    ...(mailing.variables.length
      ? [`Personalization variables: ${mailing.variables.join(', ')}.`]
      : []),
    '',
    mailing.text || 'No content: this mailing was never saved in the editor.',
  ].join('\n');
}

function registerMailingResources(server) {
  server.registerResource(
    'mailings',
    // Never listed: list_mailings pages through them, and links to each.
    new ResourceTemplate('lepatron://mailings/{mailingId}', {
      list: undefined,
    }),
    {
      title: 'LePatron mailings',
      description: 'A mailing the user may read, as text.',
      mimeType: 'text/plain',
    },
    withIdentity(async (identity, uri, { mailingId }) => {
      const mailing = await mailingOf(mailingId, identity);
      if (!mailing) throw new ResourceNotFoundError(uri.href);
      return {
        contents: [
          { uri: uri.href, mimeType: 'text/plain', text: asPlainText(mailing) },
        ],
      };
    })
  );
}

module.exports = {
  registerGetMailing,
  registerMailingResources,
  registerListMailings,
  registerListWorkspaces,
  uriOf,
};
