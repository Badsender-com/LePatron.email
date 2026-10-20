'use strict';

// Feedback and retex (ADR 0008, GLOSSARY.md). A feedback is a thumbs up or down
// and a comment. Its retex, a session summary the assistant writes, is kept only
// when the group allows retex and the user agrees to it for that feedback; the
// tool says what it kept, since the user cannot see LePatron's side.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

const SUMMARY =
  'The user asked for Black Friday subject lines; two of three were too long.';

// Turned on by #1302 (feedback and retex)
describe.skip('feedback and retex', () => {
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

  it('refuses a reference to something the user cannot read', async () => {
    const answer = await submit(f.FRANK, {
      rating: 'up',
      references: [{ kind: 'mailing', id: f.M_PROMO }],
    });

    expect(answer.error).toMatch(/not found/i);
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
