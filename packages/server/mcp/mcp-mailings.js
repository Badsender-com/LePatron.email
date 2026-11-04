'use strict';

const { z } = require('zod');
const { Mailings } = require('../common/models.common.js');
const {
  searchMailings,
  accessibleLocations,
} = require('../mailing/mailing-search.service.js');
const { resolveIdentity } = require('./mcp-identity.js');
const { failure, READ_ONLY } = require('./mcp-tool-grammar.js');
const {
  MAILING_STATUSES,
  approvedMailingIds,
  statusOf,
} = require('./mcp-mailing-status.js');

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

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

const dateFilter = (description) =>
  z
    .string()
    .datetime({ offset: true })
    .optional()
    .describe(`${description} ISO 8601, e.g. 2026-11-04T00:00:00Z.`);

function registerListMailings(server) {
  server.registerTool(
    'list_mailings',
    {
      title: 'List the mailings',
      description:
        "Lists the mailings the user may read in LePatron, in the company of this connection, the most recently updated first, a page at a time. Filters: a part of the name, tags, creation and update dates, workspaces and folders (a folder with its subfolders; list_workspaces gives their ids), the user's own mailings (mine) or a part of the author's name. A mailing with no folder sits at the root of its workspace. Each one comes with its status, derived from its facts: pushed-to-esp (a campaign or template was created in an ESP; it says nothing of sending), scheduled (approved, planned in the future), approved, or draft. LePatron never knows whether a mailing was sent. Read a mailing's content through its resource URI.",
      inputSchema: z.object({
        name: z
          .string()
          .optional()
          .describe('A part of the mailing name, whatever its case.'),
        tags: z
          .array(z.string())
          .optional()
          .describe('Tags the mailing carries, all of them.'),
        workspaceIds: z
          .array(z.string())
          .optional()
          .describe('Workspace ids, from list_workspaces.'),
        folderIds: z
          .array(z.string())
          .optional()
          .describe(
            'Folder ids, from list_workspaces: a folder with its subfolders.'
          ),
        mine: z
          .boolean()
          .optional()
          .describe('true: only the mailings the user created.'),
        author: z.string().optional().describe("A part of the author's name."),
        createdAfter: dateFilter('Created on or after this date.'),
        createdBefore: dateFilter('Created on or before this date.'),
        updatedAfter: dateFilter('Updated on or after this date.'),
        updatedBefore: dateFilter('Updated on or before this date.'),
        page: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe('The page to read, from 1. Default: 1.'),
        pageSize: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe(
            `Mailings per page, ${MAX_PAGE_SIZE} at most. Default: ${DEFAULT_PAGE_SIZE}.`
          ),
      }),
      outputSchema: z.object({
        mailings: z.array(MAILING),
        total: z.number(),
        page: z.number(),
        pageSize: z.number(),
        totalPages: z.number(),
      }),
      annotations: READ_ONLY,
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
      inputSchema: z.object({}).strict(),
      outputSchema: z.object({ workspaces: z.array(WORKSPACE) }),
      annotations: READ_ONLY,
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

module.exports = {
  registerListMailings,
  registerListWorkspaces,
  asItem,
  MAILING,
  uriOf,
};
