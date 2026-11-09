/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// Feedback (ADR 0012, GLOSSARY.md). A feedback is a thumbs up or down and a
// comment. What the work taught is a retex, apart (ADR 0021,
// mcp.retex.test.js): a feedback no longer carries a summary of the session.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

describe('feedback and retex', () => {
  beforeEach(() => harness.seed(f.SEED));
  afterEach(() => harness.disconnect());

  const submit = async (userId, args) => {
    const client = await harness.connectAs(userId);
    return harness.answerOf(
      await client.callTool({ name: 'submit_feedback', arguments: args })
    );
  };

  it('records a rating and a comment on a skill', async () => {
    const answer = await submit(f.FRANK, {
      rating: 'down',
      comment: 'The subject lines were too long',
      references: [{ kind: 'skill', id: 'redaction.subject-ideas' }],
    });

    expect(answer).toEqual({ recorded: true });
  });

  it('refuses a rating other than up or down', async () => {
    const answer = await submit(f.FRANK, { rating: 4 });

    expect(answer.error).toMatch(/rating/i);
  });

  it('refuses more references than one feedback is about', async () => {
    const answer = await submit(f.FRANK, {
      rating: 'up',
      references: Array.from({ length: 21 }, () => ({
        kind: 'skill',
        id: 'redaction.subject-ideas',
      })),
    });

    expect(answer.error).toBeDefined();
  });

  it('refuses a reference to something the user cannot read', async () => {
    const answer = await submit(f.FRANK, {
      rating: 'up',
      references: [{ kind: 'mailing', id: f.M_PROMO }],
    });

    expect(answer.error).toMatch(/not found/i);
  });

  // A mailing is pointed at only by who may read it, by the rule of the
  // search across accessible workspaces (ADR 0007).
  describe('a reference to a mailing', () => {
    const about = (id) => ({
      rating: 'up',
      references: [{ kind: 'mailing', id }],
    });

    it('records one the user may read', async () => {
      expect(await submit(f.FRANK, about(f.M_NEWSLETTER))).toEqual({
        recorded: true,
      });
      expect(harness.stored('feedbacks')[0].references).toEqual([
        { kind: 'mailing', id: f.M_NEWSLETTER, version: null },
      ]);
    });

    it('records one in a folder of a workspace the user may read', async () => {
      expect(await submit(f.FRANK, about(f.M_ARCHIVED))).toMatchObject({
        recorded: true,
      });
    });

    it('never reaches another company’s mailing, even for a super admin bound to a company', async () => {
      const client = await harness.connectAs(f.ALICE, {
        group: f.CLIENT_GROUP,
      });
      const send = async (id) =>
        harness.answerOf(
          await client.callTool({
            name: 'submit_feedback',
            arguments: about(id),
          })
        );

      expect(await send(f.M_PROMO)).toMatchObject({ recorded: true });
      expect((await send(f.M_OTHER)).error).toMatch(/not found/i);
    });

    // search gives a mailing's id prefixed with its kind: the reference
    // reads it as list_mailings' id, and says so.
    describe('by the id search gives', () => {
      it('records the mailing, once, by its id', async () => {
        const client = await harness.connectAs(f.FRANK);
        const { tools } = await client.listTools();
        const { references } = tools.find(
          (tool) => tool.name === 'submit_feedback'
        ).inputSchema.properties;

        expect(references.items.properties.id.description).toMatch(
          /list_mailings or search.*mailing:/
        );
        expect(references.items.properties.id.description).not.toMatch(
          /mailingId/
        );
        expect(
          await submit(f.FRANK, {
            rating: 'up',
            references: [
              { kind: 'mailing', id: `mailing:${f.M_NEWSLETTER}` },
              { kind: 'mailing', id: f.M_NEWSLETTER },
            ],
          })
        ).toEqual({ recorded: true });
        expect(harness.stored('feedbacks')[0].references).toEqual([
          { kind: 'mailing', id: f.M_NEWSLETTER, version: null },
        ]);
      });

      it('refuses a mailing the user may not read as its plain id', async () => {
        const prefixed = await submit(f.FRANK, about(`mailing:${f.M_PROMO}`));

        expect(prefixed.error).toMatch(/not found/i);
        expect(prefixed).toEqual(await submit(f.FRANK, about(f.M_PROMO)));
        expect(harness.stored('feedbacks')).toEqual([]);
      });
    });
  });

  // search gives an expertise's id prefixed with its kind: the reference
  // reads it as its expertiseId, and says so.
  describe('a reference to an expertise by the id search gives', () => {
    const about = (id) => ({
      rating: 'up',
      references: [{ kind: 'expertise', id }],
    });

    it('records the expertise, once, by its expertiseId', async () => {
      const client = await harness.connectAs(f.FRANK);
      const { tools } = await client.listTools();
      const { references } = tools.find(
        (tool) => tool.name === 'submit_feedback'
      ).inputSchema.properties;

      expect(references.items.properties.id.description).toMatch(
        /expertiseId, or its id from search \(expertise:/
      );
      expect(
        await submit(f.FRANK, {
          rating: 'up',
          references: [
            { kind: 'expertise', id: 'expertise:redaction.subject-line' },
            { kind: 'expertise', id: 'redaction.subject-line' },
          ],
        })
      ).toEqual({ recorded: true });
      expect(harness.stored('feedbacks')[0].references).toEqual([
        { kind: 'expertise', id: 'redaction.subject-line', version: '2.1' },
      ]);
    });

    it('refuses an expertise not served as its plain id', async () => {
      const prefixed = await submit(
        f.FRANK,
        about('expertise:design.dark-mode')
      );

      expect(prefixed.error).toMatch(/not found/i);
      expect(prefixed).toEqual(
        await submit(f.FRANK, about('design.dark-mode'))
      );
      expect(harness.stored('feedbacks')).toEqual([]);
    });
  });

  it('keeps who sent it, from which application, until the company’s log retention ends', async () => {
    const client = await harness.connectAs(f.FRANK, { clientId: 'claude' });
    const before = Date.now();

    await client.callTool({
      name: 'submit_feedback',
      arguments: { rating: 'up', comment: 'Useful' },
    });

    const [feedback] = harness.stored('feedbacks');
    expect(feedback).toMatchObject({
      _user: f.FRANK,
      _company: f.CLIENT_GROUP,
      clientId: 'claude',
    });
    // The fixture's company keeps its logs 30 days.
    const days = (new Date(feedback.expiresAt) - before) / (24 * 3600 * 1000);
    expect(days).toBeGreaterThanOrEqual(30);
    expect(days).toBeLessThan(30.01);
  });

  it('keeps each thing it is about once', async () => {
    await submit(f.FRANK, {
      rating: 'up',
      references: [
        { kind: 'skill', id: 'redaction.subject-ideas' },
        { kind: 'expertise', id: 'redaction.subject-line' },
        { kind: 'skill', id: 'redaction.subject-ideas' },
      ],
    });

    expect(harness.stored('feedbacks')[0].references).toEqual([
      { kind: 'skill', id: 'redaction.subject-ideas', version: '1.2' },
      { kind: 'expertise', id: 'redaction.subject-line', version: '2.1' },
    ]);
  });

  // The comment reaches the platform company: a short word on LePatron,
  // never room for a session summary, which a feedback no longer carries
  // (ADR 0021).
  describe('the length of a comment', () => {
    const SHORT = 'c'.repeat(500);
    const LONG = 'c'.repeat(501);

    it.each([
      ['the company allows retex', true],
      ['the company does not allow retex', false],
    ])('is 500 characters at most when %s', async (_case, allowRetex) => {
      harness.update('groups', f.CLIENT_GROUP, { allowRetex });

      const short = await submit(f.FRANK, { rating: 'up', comment: SHORT });
      const long = await submit(f.FRANK, { rating: 'up', comment: LONG });

      expect(short).toMatchObject({ recorded: true });
      expect(long.error).toMatch(/500 characters/);
      expect(harness.stored('feedbacks')).toHaveLength(1);
    });

    it('is said in the description of the tool', async () => {
      const client = await harness.connectAs(f.FRANK);
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === 'submit_feedback');

      expect(tool.description).toMatch(
        /always shared with the platform company/
      );
      expect(tool.description).toMatch(/500 characters/);
    });
  });

  // Stopping the retex forgets what it let the feedbacks keep (ADR 0012): the
  // summaries stored before ADR 0021, and the comments longer than 500
  // characters, cut. The PUT that
  // calls it is tested with the group's switches.
  describe('the retex stopped', () => {
    const LONG = 'c'.repeat(1200);
    const models = () =>
      require('../../../packages/server/common/models.common.js');
    const forgetRetex = (...args) =>
      require('../../../packages/server/mcp/mcp-access-option.js').forgetRetex(
        ...args
      );
    const kept = () => harness.stored('feedbacks');
    const SUMMARY =
      'The user asked for Black Friday subject lines; two of three were too long.';

    beforeEach(() => {
      harness.update('groups', f.CLIENT_GROUP, { allowRetex: true });
    });

    it('forgets the summaries and cuts the long comments of the company, and keeps its feedbacks', async () => {
      await models().McpFeedbacks.create({
        _company: f.CLIENT_GROUP,
        rating: 'down',
        comment: LONG,
        retex: SUMMARY,
      });
      await models().McpFeedbacks.create({
        _company: f.OTHER_GROUP,
        rating: 'up',
        comment: LONG,
        retex: 'Another company’s summary',
      });

      await forgetRetex(f.CLIENT_GROUP);
      await forgetRetex(f.CLIENT_GROUP);

      const ours = kept().find((k) => k._company === f.CLIENT_GROUP);
      expect(ours).toMatchObject({ rating: 'down', retex: null });
      expect(ours.comment).toBe('c'.repeat(500));
      expect(kept().find((k) => k._company === f.OTHER_GROUP)).toMatchObject({
        retex: 'Another company’s summary',
        comment: LONG,
      });
    });

    // JavaScript counts an emoji as two units, MongoDB as one character: a
    // comment is cut by what it holds in JavaScript, and never in the middle
    // of a character.
    it('cuts a comment of emojis to 500 units, whole characters only', async () => {
      const emojis = '\u{1F600}'.repeat(300);
      const create = (comment) =>
        models().McpFeedbacks.create({
          _company: f.CLIENT_GROUP,
          rating: 'up',
          comment,
        });
      await create(emojis);
      await create(`a${emojis}`);
      await create('é'.repeat(400));

      await forgetRetex(f.CLIENT_GROUP);

      const [even, odd, short] = kept().map((k) => k.comment);
      expect(even).toBe('\u{1F600}'.repeat(250));
      expect(odd).toBe(`a${'\u{1F600}'.repeat(249)}`);
      expect(odd).not.toMatch(/[\uD800-\uDBFF]$/);
      expect(short).toBe('é'.repeat(400));
    });
  });

  // The super admins' list of feedbacks, read through its route (agreed as a
  // third seam: no MCP client sees it).
  describe('the list of feedbacks', () => {
    let controller;
    let list;

    beforeAll(() => {
      // Not at the top of the file: the module doesn't exist until #1302.
      controller = require('../../../packages/server/mcp/mcp-feedback.controller.js');
      const { call } = require('../../helpers/super-admin-fixtures');
      list = (query) =>
        call(controller.list, {
          user: { id: f.ALICE, role: 'super_admin', isAdmin: true },
          query,
        });
    });

    beforeEach(async () => {
      await submit(f.FRANK, {
        rating: 'down',
        comment: 'Too long',
        references: [{ kind: 'skill', id: 'redaction.subject-ideas' }],
      });
      await submit(f.WREN, {
        rating: 'up',
        references: [{ kind: 'expertise', id: 'redaction.subject-line' }],
      });
    });

    it('lists feedbacks with the version of what they refer to', async () => {
      const { status, body } = await list({});

      expect(status).toBe(200);
      expect(body.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            rating: 'down',
            comment: 'Too long',
            group: { id: f.CLIENT_GROUP, name: 'A client' },
            references: [
              { kind: 'skill', id: 'redaction.subject-ideas', version: '1.2' },
            ],
          }),
          expect.objectContaining({
            rating: 'up',
            references: [
              {
                kind: 'expertise',
                id: 'redaction.subject-line',
                version: '2.1',
              },
            ],
          }),
        ])
      );
    });

    it('filters by skill or expertise, and by version', async () => {
      const bySkill = await list({
        kind: 'skill',
        id: 'redaction.subject-ideas',
      });
      const byOldVersion = await list({
        kind: 'skill',
        id: 'redaction.subject-ideas',
        version: '1.1',
      });

      expect(bySkill.body.items.map((item) => item.rating)).toEqual(['down']);
      expect(byOldVersion.body.items).toEqual([]);
    });

    // Filtered by the database, not among the latest feedbacks.
    it('finds the feedbacks on a skill under many more recent ones', async () => {
      const recent = Array.from({ length: 1200 }, (_, i) => ({
        _id: (0x7000000000 + i).toString(16).padStart(24, '0'),
        rating: 'up',
        _company: f.CLIENT_GROUP,
        references: [{ kind: 'expertise', id: 'deliverability.spam-words' }],
        createdAt: new Date(Date.now() + 1000 + i),
      }));
      const {
        McpFeedbacks,
      } = require('../../../packages/server/common/models.common.js');
      await Promise.all(
        recent.map((feedback) => McpFeedbacks.create(feedback))
      );

      const { body } = await list({
        kind: 'skill',
        id: 'redaction.subject-ideas',
      });

      expect(body.items.map((item) => item.rating)).toEqual(['down']);
    });

    it('serves a page at a time, and says how many there are', async () => {
      const first = await list({ pageSize: '1' });
      const second = await list({ pageSize: '1', page: '2' });
      const third = await list({ pageSize: '1', page: '3' });

      expect(first.body).toMatchObject({ total: 2, page: 1, pageSize: 1 });
      expect(first.body.items).toHaveLength(1);
      expect(second.body.items).toHaveLength(1);
      expect(second.body.items[0].id).not.toBe(first.body.items[0].id);
      expect(third.body.items).toEqual([]);
    });

    // A page beyond 10000 would ask the database to skip more than the list
    // can hold: the last page it serves is the 10000th.
    it.each([['10001'], ['99999999999999999999']])(
      'serves page 10000 when asked for page %p',
      async (page) => {
        const { status, body } = await list({ page });

        expect(status).toBe(200);
        expect(body.page).toBe(10000);
      }
    );

    it.each([['-3'], ['0'], ['two'], [{ $gt: 1 }]])(
      'serves page 1 when asked for page %p',
      async (page) => {
        const { status, body } = await list({ page });

        expect(status).toBe(200);
        expect(body.page).toBe(1);
      }
    );

    it('serves 50 unless asked, 200 at most', async () => {
      expect((await list({})).body.pageSize).toBe(50);
      expect((await list({ pageSize: '5000' })).body.pageSize).toBe(200);
      expect((await list({ pageSize: { $gt: 0 } })).body.pageSize).toBe(50);
    });

    it('takes a filter as text, never as a query', async () => {
      const { body } = await list({ kind: 'skill', id: { $ne: 'x' } });

      expect(body.items).toEqual([]);
    });

    it('is open to super admins only', () => {
      const {
        GUARD_CAN,
      } = require('../../../packages/server/account/auth.guard.js');
      const {
        CAPABILITIES,
      } = require('../../../packages/shared/access/roles.js');
      const { routeInspector } = require('../../helpers/express-router.js');
      const router = require('../../../packages/server/mcp/mcp-feedback.routes.js');

      expect(routeInspector(router).guardsOf('get', '/')).toEqual([
        GUARD_CAN(CAPABILITIES.PLATFORM_MANAGE),
      ]);
    });
  });
});
