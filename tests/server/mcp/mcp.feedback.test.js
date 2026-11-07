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
