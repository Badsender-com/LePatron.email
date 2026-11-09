/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// A mailing's status through MCP (#1301, ADR 0012, GLOSSARY.md "Mailing
// status"): derived from its facts on every read, never stored. Its approval
// is the app's own rule (`Comment.findApprovedMailingIds`), which the fakes
// run as an aggregation over the stored comments.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');
const {
  statusOf,
} = require('../../../packages/server/mcp/mcp-mailing-status.js');

// A planned send date as the editor stores it: a day, at 12:00 UTC.
function plannedIn(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(12, 0, 0, 0);
  return date;
}

describe('mailing status', () => {
  beforeEach(() => harness.seed(f.SEED));
  afterEach(() => {
    jest.restoreAllMocks();
    return harness.disconnect();
  });

  const list = async (args = {}) => {
    const client = await harness.connectAs(f.FRANK);
    return harness.answerOf(
      await client.callTool({ name: 'list_mailings', arguments: args })
    );
  };
  const listed = async (mailingId) =>
    (await list()).mailings.find((mailing) => mailing.id === mailingId);

  // Only a person changes a status, by approving, planning or pushing; the
  // planned day passing changes nothing.
  describe('the rule', () => {
    it.each([
      ['today', 0],
      ['yesterday', -1],
      ['next month', 31],
    ])('lists an approved mailing planned %s as scheduled', async (_, days) => {
      harness.update('mailings', f.M_APPROVED, {
        plannedSendDate: plannedIn(days),
      });

      expect(await listed(f.M_APPROVED)).toMatchObject({
        approved: true,
        status: 'scheduled',
      });
    });

    it('lists a mailing planned but not approved as a draft', async () => {
      expect(await listed(f.M_DRAFT_PAST)).toMatchObject({
        approved: false,
        status: 'draft',
      });
      harness.update('mailings', f.M_DRAFT_PAST, {
        plannedSendDate: plannedIn(10),
      });
      expect((await listed(f.M_DRAFT_PAST)).status).toBe('draft');
    });

    it('lists an approved mailing with no planned date as approved', async () => {
      expect((await listed(f.M_APPROVED)).status).toBe('approved');
    });

    it.each([
      [
        'approved and planned',
        { approved: true, plannedSendDate: plannedIn(3) },
      ],
      ['approved', { approved: true }],
      ['planned', { approved: false, plannedSendDate: plannedIn(-3) }],
      ['neither', { approved: false }],
    ])('says pushed-to-esp of a pushed mailing, %s', (_, facts) => {
      expect(statusOf({ espProfileCount: 1, ...facts })).toBe('pushed-to-esp');
    });
  });

  // A day without a time: an assistant never announces a time nobody chose.
  describe('the planned send date', () => {
    const read = async (mailingId) => {
      const client = await harness.connectAs(f.FRANK);
      return harness.answerOf(
        await client.callTool({ name: 'get_mailing', arguments: { mailingId } })
      );
    };

    it.each([
      ['list_mailings', listed],
      ['get_mailing', read],
    ])('%s gives the day the editor stored, read in UTC', async (_, answer) => {
      harness.update('mailings', f.M_SCHEDULED, {
        plannedSendDate: new Date('2026-12-01T12:00:00.000Z'),
      });

      expect((await answer(f.M_SCHEDULED)).plannedSendDate).toBe('2026-12-01');
    });

    it.each([
      ['list_mailings', listed],
      ['get_mailing', read],
    ])('%s gives null when no day is planned', async (_, answer) => {
      expect((await answer(f.M_APPROVED)).plannedSendDate).toBeNull();
    });
  });

  describe('approval, by the app’s own rule', () => {
    let nextComment = 0;
    const comment = (fields) => {
      nextComment += 1;
      return {
        _id: `507f1f77bcf86cd7994398${String(nextComment).padStart(2, '0')}`,
        _mailing: f.M_APPROVED,
        _company: f.CLIENT_GROUP,
        _author: f.ERIN,
        authorName: 'Erin',
        text: 'A word',
        decision: null,
        isDeleted: false,
        ...fields,
      };
    };
    const withComments = (...comments) =>
      harness.seed({ ...f.SEED, comments: [...f.COMMENTS, ...comments] });

    it('lists an approved mailing as approved', async () => {
      expect(await listed(f.M_APPROVED)).toMatchObject({
        approved: true,
        status: 'approved',
      });
    });

    it('lifts the approval once a root comment follows it', async () => {
      withComments(comment({ createdAt: f.daysFrom(-1) }));

      expect(await listed(f.M_APPROVED)).toMatchObject({
        approved: false,
        status: 'draft',
      });
    });

    it('keeps the approval when only a reply follows it', async () => {
      const [approval] = f.COMMENTS.filter((c) => c._mailing === f.M_APPROVED);
      withComments(
        comment({ _parentComment: approval._id, createdAt: f.daysFrom(-1) })
      );

      expect((await listed(f.M_APPROVED)).approved).toBe(true);
    });

    it('keeps the approval when the root comment after it is deleted', async () => {
      withComments(comment({ createdAt: f.daysFrom(-1), isDeleted: true }));

      expect((await listed(f.M_APPROVED)).approved).toBe(true);
    });

    it('approves again with an approval after the comment', async () => {
      withComments(
        comment({ createdAt: f.daysFrom(-2) }),
        comment({ createdAt: f.daysFrom(-1), decision: 'approved' })
      );

      expect((await listed(f.M_APPROVED)).approved).toBe(true);
    });

    // The listing already answers whether each mailing is approved, and its
    // subject and planned date: nothing is read twice.
    it('reads the approvals of a page once, and the mailings once', async () => {
      const {
        Comments,
        Mailings,
      } = require('../../../packages/server/common/models.common.js');
      const approvals = jest.spyOn(Comments, 'findApprovedMailingIds');
      const finds = jest.spyOn(Mailings, 'find');

      const { mailings } = await list({ name: 'November newsletter' });

      expect(mailings[0]).toMatchObject({
        subject: 'What is new in November',
        approved: true,
      });
      expect(approvals).toHaveBeenCalledTimes(1);
      // The listing's own check of which mailings have a preview.
      expect(finds).toHaveBeenCalledTimes(1);
    });
  });
});
