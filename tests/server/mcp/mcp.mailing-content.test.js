'use strict';

// Reading one mailing through MCP (ADR 0012): its facts and its derived status,
// its text by default and its sanitised HTML on request, with the rights the
// user has in the app.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

const getMailing = async (client, args) =>
  harness.answerOf(
    await client.callTool({ name: 'get_mailing', arguments: args })
  );

// Turned on by #1304 (read a mailing)
describe.skip('mailing content', () => {
  beforeEach(() => harness.seed(f.SEED));
  afterEach(() => harness.disconnect());

  describe('what a mailing says', () => {
    let client;
    beforeEach(async () => {
      client = await harness.connectAs(f.FRANK);
    });

    it('gives its facts', async () => {
      const answer = await getMailing(client, { mailingId: f.M_NEWSLETTER });

      expect(answer).toMatchObject({
        id: f.M_NEWSLETTER,
        name: 'Black Friday 2025',
        subject: 'Black Friday: our best prices',
        tags: ['black-friday'],
        approved: true,
        espProfileCount: 1,
        workspace: { id: f.WS_NEWS, name: 'Newsletters' },
      });
    });

    it('gives its text, without markup or styles', async () => {
      const { text } = await getMailing(client, { mailingId: f.M_NEWSLETTER });

      expect(text).toContain('Black Friday is coming');
      expect(text).toContain('our best prices of the year start on Friday.');
      expect(text).toContain('Free delivery on every order.');
      expect(text).toContain('See the offers');
      expect(text).toContain('https://shop.example.test/black-friday');
      expect(text).not.toMatch(/<[a-z]/i);
      expect(text).not.toContain('#c00');
    });

    it('keeps personalization variables, and names them', async () => {
      const answer = await getMailing(client, { mailingId: f.M_NEWSLETTER });

      expect(answer.text).toContain('{{firstname}}');
      expect(answer.variables).toEqual(['firstname']);
    });

    it('gives its HTML when asked, and then no text', async () => {
      const answer = await getMailing(client, {
        mailingId: f.M_NEWSLETTER,
        format: 'html',
      });

      expect(answer.html).toContain(
        '<a href="https://shop.example.test/black-friday"'
      );
      expect(answer.text).toBeUndefined();
    });

    it('gives the facts of a mailing never saved in the editor, without content', async () => {
      const answer = await getMailing(client, { mailingId: f.M_NO_PREVIEW });

      expect(answer).toMatchObject({ id: f.M_NO_PREVIEW, name: 'Blank draft' });
      expect(answer.text).toBeNull();
    });
  });

  describe('mailing status', () => {
    let client;
    beforeEach(async () => {
      client = await harness.connectAs(f.FRANK);
    });
    const statusOf = async (mailingId) =>
      (await getMailing(client, { mailingId })).status;

    it.each([
      [
        'pushed to an ESP, whatever its date or approval',
        'M_NEWSLETTER',
        'pushed-to-esp',
      ],
      ['approved and planned in the future', 'M_SCHEDULED', 'scheduled'],
      ['approved, with no planned date', 'M_APPROVED', 'approved'],
      [
        'planned in the past but never pushed nor approved',
        'M_DRAFT_PAST',
        'draft',
      ],
      ['neither approved, planned nor pushed', 'M_ARCHIVED', 'draft'],
    ])('reads a mailing %s', async (_case, key, status) => {
      expect(await statusOf(f[key])).toBe(status);
    });

    // A later comment withdraws the approval, as in the app.
    it('drops the approval once a comment follows it', async () => {
      harness.seed({
        ...f.SEED,
        comments: [
          ...f.COMMENTS,
          {
            _id: '507f1f77bcf86cd799439710',
            _mailing: f.M_APPROVED,
            _company: f.CLIENT_GROUP,
            author: f.ERIN,
            text: 'One more change',
            createdAt: f.daysFrom(-1),
          },
        ],
      });
      client = await harness.connectAs(f.FRANK);

      expect(await statusOf(f.M_APPROVED)).toBe('draft');
    });

    it('never says a mailing was sent', async () => {
      const statuses = await Promise.all(
        [f.M_NEWSLETTER, f.M_SCHEDULED, f.M_APPROVED, f.M_DRAFT_PAST].map(
          statusOf
        )
      );

      expect(statuses).not.toContain('sent');
    });
  });

  describe('rights', () => {
    it.each([
      ['a workspace they are not a member of', f.FRANK, 'M_PROMO'],
      ['another group', f.FRANK, 'M_OTHER'],
      ['a mailing that does not exist', f.FRANK, null],
    ])('does not read a mailing of %s', async (_case, userId, key) => {
      const client = await harness.connectAs(userId);
      const mailingId = key ? f[key] : '507f1f77bcf86cd7994394ff';

      const answer = await getMailing(client, { mailingId });

      expect(answer.error).toMatch(/not found/i);
      expect(answer.error).not.toContain('Spring sale');
    });

    it('reads a mailing in a folder of a workspace the user is a member of', async () => {
      const client = await harness.connectAs(f.FRANK);

      expect(
        await getMailing(client, { mailingId: f.M_ARCHIVED })
      ).toMatchObject({
        name: 'Black Friday 2024',
      });
    });

    it('lets a company admin read every workspace of the group', async () => {
      const client = await harness.connectAs(f.ERIN);

      expect(await getMailing(client, { mailingId: f.M_PROMO })).toMatchObject({
        name: 'Spring sale',
      });
    });

    it('follows a group where every user reaches every workspace', async () => {
      harness.update('groups', f.CLIENT_GROUP, {
        userHasAccessToAllWorkspaces: true,
      });
      const client = await harness.connectAs(f.FRANK);

      expect(await getMailing(client, { mailingId: f.M_PROMO })).toMatchObject({
        name: 'Spring sale',
      });
    });

    it('keeps a super admin in the group picked at consent', async () => {
      const client = await harness.connectAs(f.ALICE, {
        group: f.CLIENT_GROUP,
      });

      expect(await getMailing(client, { mailingId: f.M_PROMO })).toMatchObject({
        name: 'Spring sale',
      });
      expect(
        (await getMailing(client, { mailingId: f.M_OTHER })).error
      ).toMatch(/not found/i);
    });

    it('applies a role change at the next call', async () => {
      const client = await harness.connectAs(f.FRANK);
      expect(
        (await getMailing(client, { mailingId: f.M_PROMO })).error
      ).toMatch(/not found/i);

      harness.update('users', f.FRANK, { role: 'company_admin' });

      expect(await getMailing(client, { mailingId: f.M_PROMO })).toMatchObject({
        name: 'Spring sale',
      });
    });
  });
});
