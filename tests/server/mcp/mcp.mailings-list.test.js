/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// Listing mailings through MCP (ADR 0012): the search across accessible
// workspaces (ADR 0007, `searchMailings`) answers it, so the same rule decides
// what comes back in the app and in an assistant. Each item carries its derived
// status. Filters are the search's own (name, tags, dates); pages hold 100
// mailings at most.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

const CLIENT_MAILINGS = [
  f.M_NEWSLETTER,
  f.M_SCHEDULED,
  f.M_APPROVED,
  f.M_DRAFT_PAST,
  f.M_ARCHIVED,
  f.M_NO_PREVIEW,
  f.M_PROMO,
];
const NEWS_MAILINGS = CLIENT_MAILINGS.filter((id) => id !== f.M_PROMO);

describe('mailings list and status', () => {
  beforeEach(() => harness.seed(f.SEED));
  afterEach(() => harness.disconnect());

  const list = async (userId, args = {}, options) => {
    const client = await harness.connectAs(userId, options);
    return harness.answerOf(
      await client.callTool({ name: 'list_mailings', arguments: args })
    );
  };
  const ids = ({ mailings }) => mailings.map((mailing) => mailing.id).sort();

  describe('which mailings come back', () => {
    it.each([
      ['regular user', f.FRANK],
      ['writer', f.WREN],
      ['reviewer', f.REX],
    ])(
      'gives a %s the mailings of their workspaces, folders included',
      async (_role, userId) => {
        expect(ids(await list(userId))).toEqual([...NEWS_MAILINGS].sort());
      }
    );

    it.each([
      ['company admin', f.ERIN],
      ['tech admin', f.TESS],
    ])('gives a %s every workspace of the group', async (_role, userId) => {
      expect(ids(await list(userId))).toEqual([...CLIENT_MAILINGS].sort());
    });

    it('follows a group where every user reaches every workspace', async () => {
      harness.update('groups', f.CLIENT_GROUP, {
        userHasAccessToAllWorkspaces: true,
      });

      expect(ids(await list(f.FRANK))).toEqual([...CLIENT_MAILINGS].sort());
    });

    it('gives a super admin the group picked at consent, and only it', async () => {
      const answer = await list(f.ALICE, {}, { group: f.CLIENT_GROUP });

      expect(ids(answer)).toEqual([...CLIENT_MAILINGS].sort());
    });

    it('never gives the mailings of another group', async () => {
      expect(ids(await list(f.OTTO))).toEqual([f.M_OTHER]);
      expect(ids(await list(f.ERIN))).not.toContain(f.M_OTHER);
    });
  });

  describe('what an item says', () => {
    it('gives its facts, its location and its status', async () => {
      const { mailings } = await list(f.FRANK, { name: 'Black Friday 2025' });

      expect(mailings).toEqual([
        expect.objectContaining({
          id: f.M_NEWSLETTER,
          name: 'Black Friday 2025',
          subject: 'Black Friday: our best prices',
          tags: ['black-friday'],
          author: 'Wren',
          template: 'Brand template',
          status: 'pushed-to-esp',
          approved: true,
          espProfileCount: 1,
          workspace: { id: f.WS_NEWS, name: 'Newsletters' },
        }),
      ]);
    });

    it('names the folder of a mailing filed in one', async () => {
      const { mailings } = await list(f.FRANK, { name: 'Black Friday 2024' });

      expect(mailings[0]).toMatchObject({
        folder: { id: f.FOLDER_ARCHIVE, name: 'Archive' },
        workspace: { id: f.WS_NEWS, name: 'Newsletters' },
        status: 'draft',
      });
    });

    it('never gives content: reading a mailing is get_mailing', async () => {
      const { mailings } = await list(f.FRANK);

      mailings.forEach((mailing) => {
        expect(mailing.text).toBeUndefined();
        expect(mailing.html).toBeUndefined();
      });
    });
  });

  describe('links', () => {
    it('links each mailing of the page as a resource', async () => {
      const client = await harness.connectAs(f.FRANK);
      const result = await client.callTool({
        name: 'list_mailings',
        arguments: { name: 'Black Friday' },
      });

      const links = result.content.filter(
        (part) => part.type === 'resource_link'
      );
      expect(links.map((link) => link.uri).sort()).toEqual(
        [
          `lepatron://mailings/${f.M_ARCHIVED}`,
          `lepatron://mailings/${f.M_NEWSLETTER}`,
        ].sort()
      );
      expect(links.find((l) => l.uri.endsWith(f.M_NEWSLETTER))).toMatchObject({
        name: 'Black Friday 2025',
      });
    });
  });

  describe('filters and pages', () => {
    it('filters by name, whatever the case', async () => {
      expect(ids(await list(f.FRANK, { name: 'BLACK FRIDAY' }))).toEqual(
        [f.M_ARCHIVED, f.M_NEWSLETTER].sort()
      );
    });

    it('filters by name, whatever the accents, both ways', async () => {
      harness.update('mailings', f.M_APPROVED, {
        name: 'Événement de rentrée',
      });

      expect(ids(await list(f.FRANK, { name: 'evenement' }))).toEqual([
        f.M_APPROVED,
      ]);
      expect(ids(await list(f.FRANK, { name: 'Black Fridäy' }))).toEqual(
        [f.M_ARCHIVED, f.M_NEWSLETTER].sort()
      );
    });

    it('takes every character of the name as written', async () => {
      expect(ids(await list(f.FRANK, { name: '.*' }))).toEqual([]);
    });

    it('filters by tag', async () => {
      expect(ids(await list(f.FRANK, { tags: ['black-friday'] }))).toEqual(
        [f.M_ARCHIVED, f.M_NEWSLETTER].sort()
      );
    });

    it('filters by update date', async () => {
      const answer = await list(f.FRANK, {
        updatedAfter: f.daysFrom(-3).toISOString(),
      });

      expect(ids(answer)).toEqual([...NEWS_MAILINGS].sort());
      expect(
        ids(await list(f.FRANK, { updatedAfter: f.daysFrom(-1).toISOString() }))
      ).toEqual([]);
    });

    it('lists the most recently updated first by default', async () => {
      harness.update('mailings', f.M_APPROVED, { updatedAt: f.daysFrom(0) });

      const { mailings } = await list(f.FRANK);

      expect(mailings[0].id).toBe(f.M_APPROVED);
    });

    it('pages the answer and says how many there are', async () => {
      const first = await list(f.FRANK, { pageSize: 2 });
      const second = await list(f.FRANK, { pageSize: 2, page: 2 });

      expect(first.mailings).toHaveLength(2);
      expect(first).toMatchObject({ total: NEWS_MAILINGS.length, page: 1 });
      expect(second.mailings.map((m) => m.id)).not.toEqual(
        expect.arrayContaining(first.mailings.map((m) => m.id))
      );
    });

    it('filters by workspace', async () => {
      expect(ids(await list(f.FRANK, { workspaceIds: [f.WS_NEWS] }))).toEqual(
        [...NEWS_MAILINGS].sort()
      );
      expect(ids(await list(f.ERIN, { workspaceIds: [f.WS_PROMO] }))).toEqual([
        f.M_PROMO,
      ]);
    });

    // An assistant sends an empty list for a filter it leaves blank.
    it('takes an empty list of workspaces or folders as no filter', async () => {
      expect(
        ids(await list(f.FRANK, { workspaceIds: [], folderIds: [] }))
      ).toEqual(ids(await list(f.FRANK)));
    });

    it('filters by folder, its subfolders included', async () => {
      const SUBFOLDER = '507f1f77bcf86cd799439302';
      const IN_SUBFOLDER = '507f1f77bcf86cd799439409';
      harness.seed({
        ...f.SEED,
        folders: [
          ...f.SEED.folders,
          { _id: SUBFOLDER, name: '2024', _parentFolder: f.FOLDER_ARCHIVE },
        ],
        mailings: [
          ...f.SEED.mailings,
          {
            ...f.SEED.mailings.find((m) => m._id === f.M_ARCHIVED),
            _id: IN_SUBFOLDER,
            name: 'Cyber Monday 2024',
            _parentFolder: SUBFOLDER,
          },
        ],
      });

      expect(
        ids(await list(f.FRANK, { folderIds: [f.FOLDER_ARCHIVE] }))
      ).toEqual([f.M_ARCHIVED, IN_SUBFOLDER].sort());
      expect(ids(await list(f.FRANK, { folderIds: [SUBFOLDER] }))).toEqual([
        IN_SUBFOLDER,
      ]);
    });

    it("filters the user's own mailings", async () => {
      expect(ids(await list(f.WREN, { mine: true }))).toEqual([f.M_NEWSLETTER]);
      expect(ids(await list(f.FRANK, { mine: true }))).toEqual([]);
    });

    it("filters by a part of the author's name, whatever the case", async () => {
      expect(ids(await list(f.FRANK, { author: 'WREN' }))).toEqual([
        f.M_NEWSLETTER,
      ]);
    });

    it('finds nothing in a workspace the user may not read', async () => {
      expect(ids(await list(f.FRANK, { workspaceIds: [f.WS_PROMO] }))).toEqual(
        []
      );
      expect(ids(await list(f.ERIN, { workspaceIds: [f.WS_OTHER] }))).toEqual(
        []
      );
    });

    it('refuses a page of more than 100 mailings', async () => {
      const answer = await list(f.FRANK, { pageSize: 101 });

      expect(answer.error).toMatch(/100/);
    });

    it('refuses a page past the 10,000th, saying so', async () => {
      const answer = await list(f.FRANK, { page: 10001 });

      expect(answer.error).toMatch(/10000/);
      expect(answer.error).not.toMatch(/BAD_FORMAT_PAGINATION/);
      expect(await list(f.FRANK, { page: 10000 })).toMatchObject({
        mailings: [],
      });
    });
  });

  describe('workspaces and folders', () => {
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
});
