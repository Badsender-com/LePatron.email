/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// Reading one mailing through MCP (ADR 0012): its facts and its derived status,
// its text by default and its sanitised HTML on request, with the rights the
// user has in the app.

const mongoose = require('mongoose');
const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');
const {
  sanitizePreviewHtml,
} = require('../../../packages/server/utils/preview-html-sanitizer.js');

// A subfolder of FOLDER_ARCHIVE, known by its parent, as the app files it.
const SUBFOLDER = {
  _id: '507f1f77bcf86cd799439302',
  name: '2024',
  _parentFolder: '507f1f77bcf86cd799439301',
};

const getMailing = async (client, args) =>
  harness.answerOf(
    await client.callTool({ name: 'get_mailing', arguments: args })
  );

describe('mailing content', () => {
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
        'href="https://shop.example.test/black-friday"'
      );
      expect(answer.text).toBeUndefined();
    });

    it('gives the HTML the app previews, sanitised', async () => {
      const unsafe =
        '<html><body><p>Hi</p><script>alert(1)</script></body></html>';
      harness.update('mailings', f.M_NEWSLETTER, { previewHtml: unsafe });

      const { html } = await getMailing(client, {
        mailingId: f.M_NEWSLETTER,
        format: 'html',
      });

      expect(html).toBe(sanitizePreviewHtml(unsafe));
      expect(html).not.toContain('<script');
    });

    it('gives its preheader, the hidden text before the visible one', async () => {
      harness.update('mailings', f.M_NEWSLETTER, {
        previewHtml: `<html><body>
          <span style="display: none !important; visibility: hidden; max-height: 0px; opacity: 0">Up to 50% off&zwnj;&nbsp;&zwnj;&nbsp;</span>
          <p>Black Friday is coming</p>
          <div style="display:none">Mobile only</div>
        </body></html>`,
      });

      const { text } = await getMailing(client, { mailingId: f.M_NEWSLETTER });

      expect(text.split('\n\n')).toEqual([
        'Subject: Black Friday: our best prices',
        'Preheader: Up to 50% off',
        'Black Friday is coming',
      ]);
    });

    it('marks a heading and a link the Markdown way', async () => {
      const { text } = await getMailing(client, { mailingId: f.M_NEWSLETTER });

      expect(text).toContain('# Black Friday is coming');
      expect(text).toContain(
        '[See the offers](https://shop.example.test/black-friday)'
      );
    });

    it('gives the facts of a mailing never saved in the editor, without content', async () => {
      const answer = await getMailing(client, { mailingId: f.M_NO_PREVIEW });

      expect(answer).toMatchObject({
        id: f.M_NO_PREVIEW,
        name: 'Blank draft',
        text: null,
        contentMissing: 'never-saved',
      });
    });

    it('gives where it sits, down to its subfolder', async () => {
      harness.seed({
        ...f.SEED,
        folders: [...f.SEED.folders, SUBFOLDER],
      });
      harness.update('mailings', f.M_ARCHIVED, {
        _parentFolder: SUBFOLDER._id,
      });

      const answer = await getMailing(client, { mailingId: f.M_ARCHIVED });

      expect(answer).toMatchObject({
        workspace: { id: f.WS_NEWS, name: 'Newsletters' },
        folder: { id: f.FOLDER_ARCHIVE, name: 'Archive' },
        subfolder: { id: SUBFOLDER._id, name: '2024' },
      });
    });
  });

  describe('as a resource', () => {
    it('reads the mailing a list links to, as text', async () => {
      const client = await harness.connectAs(f.FRANK);

      const { contents } = await client.readResource({
        uri: `lepatron://mailings/${f.M_NEWSLETTER}`,
      });

      expect(contents[0].mimeType).toBe('text/plain');
      expect(contents[0].text).toContain('Black Friday is coming');
    });

    it('does not read a mailing the user cannot reach', async () => {
      const client = await harness.connectAs(f.FRANK);

      await expect(
        client.readResource({ uri: `lepatron://mailings/${f.M_PROMO}` })
      ).rejects.toThrow(/not found/i);
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
      ['approved, with a planned send date', 'M_SCHEDULED', 'scheduled'],
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
            _mailing: mongoose.Types.ObjectId(f.M_APPROVED),
            _company: f.CLIENT_GROUP,
            _author: f.ERIN,
            authorName: 'Erin',
            text: 'One more change',
            isDeleted: false,
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
    // Every role of ADR 0004, on a workspace the members read and one they
    // do not: the rule of the listing.
    it.each([
      ['super admin, in the group picked at consent', 'ALICE', true, true],
      ['company admin', 'ERIN', true, true],
      ['tech admin', 'TESS', true, true],
      ['regular user', 'FRANK', true, false],
      ['writer', 'WREN', true, false],
      ['reviewer', 'REX', true, false],
    ])(
      'lets a %s read as the listing does',
      async (_case, key, ours, theirs) => {
        const client = await harness.connectAs(f[key], {
          group: f.CLIENT_GROUP,
        });
        const reads = async (mailingId) =>
          !(await getMailing(client, { mailingId })).error;

        expect(await reads(f.M_NEWSLETTER)).toBe(ours);
        expect(await reads(f.M_PROMO)).toBe(theirs);
      }
    );

    it('does not read a mailing filed in a folder of another group', async () => {
      harness.seed({
        ...f.SEED,
        folders: [
          ...f.SEED.folders,
          { _id: SUBFOLDER._id, name: 'Theirs', _workspace: f.WS_OTHER },
        ],
      });
      harness.update('mailings', f.M_ARCHIVED, {
        _parentFolder: SUBFOLDER._id,
      });
      const client = await harness.connectAs(f.ALICE, {
        group: f.CLIENT_GROUP,
      });

      expect(
        (await getMailing(client, { mailingId: f.M_ARCHIVED })).error
      ).toMatch(/not found/i);
    });

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

    // search gives a mailing's id prefixed with its kind: get_mailing reads
    // it as list_mailings' id, and says so.
    describe('the id search gives', () => {
      it('reads the mailing', async () => {
        const client = await harness.connectAs(f.FRANK);
        const { tools } = await client.listTools();
        const { mailingId } = tools.find(
          (tool) => tool.name === 'get_mailing'
        ).inputSchema.properties;

        expect(mailingId.description).toMatch(/search.*mailing:/);
        expect(
          await getMailing(client, { mailingId: `mailing:${f.M_NEWSLETTER}` })
        ).toMatchObject({ id: f.M_NEWSLETTER, name: 'Black Friday 2025' });
      });

      it('refuses a mailing the user may not read as its plain id', async () => {
        const client = await harness.connectAs(f.FRANK);

        const prefixed = await getMailing(client, {
          mailingId: `mailing:${f.M_PROMO}`,
        });

        expect(prefixed.error).toMatch(/not found/i);
        expect(prefixed).toEqual(
          await getMailing(client, { mailingId: f.M_PROMO })
        );
      });
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
