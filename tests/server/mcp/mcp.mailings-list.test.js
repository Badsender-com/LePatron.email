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

// Turned on by #1301 (list mailings and their status)
describe.skip('mailings list and status', () => {
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

  describe('filters and pages', () => {
    it('filters by name, whatever the case', async () => {
      expect(ids(await list(f.FRANK, { name: 'BLACK FRIDAY' }))).toEqual(
        [f.M_ARCHIVED, f.M_NEWSLETTER].sort()
      );
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

    it('refuses a page of more than 100 mailings', async () => {
      const answer = await list(f.FRANK, { pageSize: 101 });

      expect(answer.error).toMatch(/100/);
    });
  });
});
