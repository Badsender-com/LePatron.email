'use strict';

const mongoose = require('mongoose');
const { z } = require('zod');
const {
  ResourceTemplate,
  ResourceNotFoundError,
} = require('@modelcontextprotocol/server');
const { Mailings, Workspaces, Folders } = require('../common/models.common.js');
const permissions = require('../account/permissions.js');
const {
  searchMailings,
  accessibleLocations,
} = require('../mailing/mailing-search.service.js');
const { sanitizePreviewCached } = require('../mailing/mailing.service.js');
const { resolveIdentity } = require('./mcp-identity.js');
const {
  MAILING_STATUSES,
  approvedMailingIds,
  statusOf,
} = require('./mcp-mailing-status.js');
const { mailingText, variablesOf } = require('./mcp-mailing-text.js');

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

const uriOf = (mailingId) => `lepatron://mailings/${mailingId}`;

// Where a mailing sits, from its folder up before any workspace it names, as
// the search reads it (a move leaves `null` in the field it left). A subfolder
// is known by its parent folder, even one that still names a workspace.
async function placeOf(mailing) {
  const chain = [];
  let folderId = mailing._parentFolder;
  for (let depth = 0; folderId && depth < 20; depth += 1) {
    // eslint-disable-next-line no-await-in-loop
    const folder = await Folders.findById(folderId)
      .select('name _workspace _parentFolder')
      .lean();
    if (!folder) return null;
    chain.unshift(folder);
    folderId = folder._parentFolder;
  }
  const workspaceId = chain.length ? chain[0]._workspace : mailing._workspace;
  if (!workspaceId) return null;
  const workspace = await Workspaces.findById(workspaceId).lean();
  if (!workspace) return null;
  const reference = ({ _id, name }) => ({ id: String(_id), name });
  const [folder, subfolder] = chain;
  return {
    workspace,
    location: {
      workspace: reference(workspace),
      ...(folder && { folder: reference(folder) }),
      ...(subfolder && { subfolder: reference(subfolder) }),
    },
  };
}

// A mailing the user may read and where it sits, or null.
async function readable(mailingId, { user, group }, fields) {
  if (!mongoose.Types.ObjectId.isValid(String(mailingId))) return null;
  const mailing = await Mailings.findOne({
    _id: String(mailingId),
    _company: String(group._id),
  })
    .select(fields)
    .lean();
  if (!mailing) return null;
  const place = await placeOf(mailing);
  if (!place || !permissions.canReadWorkspace(user, place.workspace, group)) {
    return null;
  }
  return { mailing, location: place.location };
}

/**
 * A mailing the user may read, in the group the token is bound to, or null
 * (ADR 0012): the read rule of the app (`canReadWorkspace`), and never another
 * group, even for a super admin, who reads every workspace in the app.
 *
 * @param {string} mailingId
 * @param {{ user: Object, group: Object }} identity from resolveIdentity
 * @returns {Promise<Object|null>} the mailing, lean, without its content
 */
async function readableMailing(mailingId, identity) {
  const found = await readable(mailingId, identity, '-data -previewHtml');
  return found && found.mailing;
}

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

const failure = (text) => ({
  isError: true,
  content: [{ type: 'text', text }],
});

/**
 * The mailings a user may read in the group the token is bound to (ADR 0012),
 * answered by the search across accessible workspaces (ADR 0007): the same
 * rule decides what comes back in the app and in an assistant. Each one with
 * its derived status, and linked as a resource.
 */
async function listMailings(args, ctx) {
  const { user } = await resolveIdentity(ctx.http?.authInfo);
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

function registerListMailings(server) {
  server.registerTool(
    'list_mailings',
    {
      title: 'List the mailings',
      description:
        "Lists the mailings the user may read in LePatron, in the company of this connection, the most recently updated first, a page at a time. Filters: a part of the name, tags, creation and update dates, workspaces and folders (a folder with its subfolders; list_workspaces gives their ids), the user's own mailings (mine) or a part of the author's name. A mailing with no folder sits at the root of its workspace. Each one comes with its status, derived from its facts: pushed-to-esp (a campaign or template was created in an ESP; it says nothing of sending), scheduled (approved, planned in the future), approved, or draft. LePatron never knows whether a mailing was sent. Read a mailing's content through its resource URI.",
      inputSchema: z.object({
        name: z.string().optional(),
        tags: z.array(z.string()).optional(),
        workspaceIds: z.array(z.string()).optional(),
        folderIds: z.array(z.string()).optional(),
        mine: z.boolean().optional(),
        author: z.string().optional(),
        createdAfter: z.string().datetime({ offset: true }).optional(),
        createdBefore: z.string().datetime({ offset: true }).optional(),
        updatedAfter: z.string().datetime({ offset: true }).optional(),
        updatedBefore: z.string().datetime({ offset: true }).optional(),
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).optional(),
      }),
      outputSchema: z.object({
        mailings: z.array(MAILING),
        total: z.number(),
        page: z.number(),
        pageSize: z.number(),
        totalPages: z.number(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    listMailings
  );
}

const FOLDER = REFERENCE.extend({ subfolders: z.array(REFERENCE) });
const WORKSPACE = REFERENCE.extend({ folders: z.array(FOLDER) });

function registerListWorkspaces(server) {
  server.registerTool(
    'list_workspaces',
    {
      title: 'List the workspaces',
      description:
        'Lists the workspaces the user may read in LePatron, in the company of this connection, each with its folders and their subfolders: where mailings are filed. Give their ids to list_mailings to look in some of them only.',
      inputSchema: z.object({}),
      outputSchema: z.object({ workspaces: z.array(WORKSPACE) }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (_args, ctx) => {
      const { user } = await resolveIdentity(ctx.http?.authInfo);
      const answer = { workspaces: await accessibleLocations(user) };
      return {
        content: [{ type: 'text', text: JSON.stringify(answer) }],
        structuredContent: answer,
      };
    }
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
async function mailingOf(mailingId, identity, format = 'text') {
  const found = await readable(mailingId, identity, '-data');
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

function registerGetMailing(server) {
  server.registerTool(
    'get_mailing',
    {
      title: 'Read a mailing',
      description:
        'Reads one mailing the user may read in LePatron: its facts and status, as list_mailings gives them, and its content. By default its text, in reading order: subject, preheader, headings after #, paragraphs, links as [label](href), images by their alternative text. With format html, its HTML instead, as the app previews it. Personalization variables ({{firstname}}, %%FIRSTNAME%%, [[firstname]]) are kept where they stand and listed in variables: never fill them in. A mailing never saved in the editor has no content (null).',
      inputSchema: z.object({
        mailingId: z.string(),
        format: z.enum(FORMATS).optional(),
      }),
      outputSchema: MAILING.extend({
        text: z.string().nullable().optional(),
        html: z.string().nullable().optional(),
        variables: z.array(z.string()),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ mailingId, format }, ctx) => {
      const identity = await resolveIdentity(ctx.http?.authInfo);
      const answer = await mailingOf(mailingId, identity, format);
      if (!answer) return failure(MAILING_NOT_FOUND);
      return {
        content: [{ type: 'text', text: JSON.stringify(answer) }],
        structuredContent: answer,
      };
    }
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
    async (uri, { mailingId }, ctx) => {
      const identity = await resolveIdentity(ctx.http?.authInfo);
      const mailing = await mailingOf(mailingId, identity);
      if (!mailing) throw new ResourceNotFoundError(uri.href);
      return {
        contents: [
          { uri: uri.href, mimeType: 'text/plain', text: asPlainText(mailing) },
        ],
      };
    }
  );
}

module.exports = {
  readableMailing,
  registerGetMailing,
  registerMailingResources,
  registerListMailings,
  registerListWorkspaces,
  uriOf,
};
