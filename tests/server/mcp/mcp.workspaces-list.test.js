/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// Listing the workspaces through MCP (ADR 0012, `list_workspaces`): those the
// user may read in the company of the connection, each with its folders and
// their subfolders, where list_mailings may look (ADR 0007).

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

describe('workspaces and folders', () => {
  beforeEach(() => harness.seed(f.SEED));
  afterEach(() => harness.disconnect());

  const workspacesOf = async (userId) => {
    const client = await harness.connectAs(userId);
    return harness.answerOf(
      await client.callTool({ name: 'list_workspaces', arguments: {} })
    ).workspaces;
  };

  it('lists the workspaces the user reads, with their folders', async () => {
    expect(await workspacesOf(f.FRANK)).toEqual([
      {
        id: f.WS_NEWS,
        name: 'Newsletters',
        folders: [{ id: f.FOLDER_ARCHIVE, name: 'Archive', subfolders: [] }],
      },
    ]);
  });

  // A subfolder from older data may still name a workspace: its parent
  // folder says where it is.
  it('lists the subfolders of a folder, by name', async () => {
    harness.seed({
      ...f.SEED,
      folders: [
        ...f.SEED.folders,
        {
          _id: '507f1f77bcf86cd799439303',
          name: 'Winter',
          _parentFolder: f.FOLDER_ARCHIVE,
        },
        {
          _id: '507f1f77bcf86cd799439302',
          name: 'Autumn',
          _parentFolder: f.FOLDER_ARCHIVE,
          _workspace: f.WS_PROMO,
        },
      ],
    });

    expect(await workspacesOf(f.FRANK)).toEqual([
      {
        id: f.WS_NEWS,
        name: 'Newsletters',
        folders: [
          {
            id: f.FOLDER_ARCHIVE,
            name: 'Archive',
            subfolders: [
              { id: '507f1f77bcf86cd799439302', name: 'Autumn' },
              { id: '507f1f77bcf86cd799439303', name: 'Winter' },
            ],
          },
        ],
      },
    ]);
  });

  it('lists every workspace of the group to a company admin', async () => {
    expect((await workspacesOf(f.ERIN)).map((w) => w.id).sort()).toEqual(
      [f.WS_NEWS, f.WS_PROMO].sort()
    );
  });
});
