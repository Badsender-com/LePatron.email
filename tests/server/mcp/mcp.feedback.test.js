/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// Feedback and retex (ADR 0012, GLOSSARY.md). A feedback is a thumbs up or down
// and a comment. Its retex, a session summary the assistant writes, is kept only
// when the group allows retex and the user agrees to it for that feedback; the
// tool says what it kept, since the user cannot see LePatron's side.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

const SUMMARY =
  'The user asked for Black Friday subject lines; two of three were too long.';

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

    expect(answer).toEqual({ recorded: true, retex: 'none' });
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
        retex: 'none',
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

  // The comment reaches the platform company whatever the retex: without
  // it, a short word on LePatron, never room for a session summary.
  describe('the length of a comment', () => {
    const SHORT = 'c'.repeat(500);
    const LONG = 'c'.repeat(501);

    it.each([
      ['the company does not allow retex', false, true],
      ['the user does not agree to it', true, false],
    ])(
      'is 500 characters at most when %s',
      async (_case, allowRetex, consent) => {
        harness.update('groups', f.CLIENT_GROUP, { allowRetex });

        const short = await submit(f.FRANK, {
          rating: 'up',
          comment: SHORT,
          consentToRetex: consent,
        });
        const long = await submit(f.FRANK, {
          rating: 'up',
          comment: LONG,
          consentToRetex: consent,
        });

        expect(short).toMatchObject({ recorded: true });
        expect(long.error).toMatch(/500 characters/);
        expect(harness.stored('feedbacks')).toHaveLength(1);
      }
    );

    it('is 4000 characters at most when the retex is granted', async () => {
      harness.update('groups', f.CLIENT_GROUP, { allowRetex: true });

      const answer = await submit(f.FRANK, {
        rating: 'up',
        comment: 'c'.repeat(4000),
        consentToRetex: true,
      });

      expect(answer).toMatchObject({ recorded: true });
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

  it.each([
    ['the group does not allow retex', false, true, 'dropped'],
    ['the user does not agree to it', true, false, 'dropped'],
    ['the group allows it and the user agrees', true, true, 'kept'],
  ])(
    'handles a session summary when %s',
    async (_case, allowRetex, consent, retex) => {
      harness.update('groups', f.CLIENT_GROUP, { allowRetex });

      const answer = await submit(f.FRANK, {
        rating: 'down',
        comment: 'Too long',
        consentToRetex: consent,
        sessionSummary: SUMMARY,
      });

      expect(answer).toEqual({ recorded: true, retex });
    }
  );

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
      harness.update('groups', f.CLIENT_GROUP, { allowRetex: true });
      await submit(f.FRANK, {
        rating: 'down',
        comment: 'Too long',
        references: [{ kind: 'skill', id: 'redaction.subject-ideas' }],
        consentToRetex: true,
        sessionSummary: SUMMARY,
      });
      await submit(f.WREN, {
        rating: 'up',
        references: [{ kind: 'expertise', id: 'redaction.subject-line' }],
        consentToRetex: false,
        sessionSummary: 'Not to be kept',
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
            retex: SUMMARY,
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
            retex: null,
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
