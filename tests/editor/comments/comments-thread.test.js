'use strict';

// What the comments panel shows, out of the comments (ADR 0020).

const {
  threadOf,
  approvalOf,
  segmentsOf,
} = require('../../../packages/editor/src/js/ext/comments/comments-thread.js');

let clock = 0;
const comment = (fields = {}) => ({
  _id: `c${++clock}`,
  _parentComment: null,
  resolved: false,
  decision: null,
  severity: 'info',
  blockId: null,
  createdAt: new Date(2026, 10, 5, 10, clock).toISOString(),
  authorName: 'Ana',
  ...fields,
});

beforeEach(() => {
  clock = 0;
});

describe('the thread', () => {
  it('shows the newest first, the resolved folded apart', () => {
    const a = comment();
    const b = comment({ resolved: true });
    const c = comment();
    const thread = threadOf([a, b, c]);
    expect(thread.items.map((x) => x._id)).toEqual([c._id, a._id]);
    expect(thread.resolved.map((x) => x._id)).toEqual([b._id]);
  });

  it('keeps an approval in the thread, never folded as resolved', () => {
    const approval = comment({ decision: 'approved', resolved: true });
    expect(threadOf([approval]).items).toEqual([approval]);
  });

  it('gives each comment its replies, oldest first', () => {
    const root = comment();
    const first = comment({ _parentComment: root._id });
    const second = comment({ _parentComment: root._id });
    const thread = threadOf([second, root, first]);
    expect(thread.items).toEqual([root]);
    expect(thread.repliesOf(root._id)).toEqual([first, second]);
  });

  it("reads one block's comments, without the approvals of the email", () => {
    const onBlock = comment({ blockId: 'b1' });
    comment({ blockId: 'b2' });
    const approval = comment({ decision: 'approved' });
    expect(threadOf([onBlock, approval], 'b1').items).toEqual([onBlock]);
  });
});

describe('the approval', () => {
  it('holds while the last root comment is an approval', () => {
    const resolved = comment({ resolved: true });
    const approval = comment({ decision: 'approved' });
    expect(approvalOf([resolved, approval])).toEqual({
      approved: true,
      liftedBy: {},
    });
  });

  it('says which comment lifted it', () => {
    const approval = comment({ decision: 'approved', authorName: 'Ana' });
    const after = comment({ authorName: 'Tom' });
    const { approved, liftedBy } = approvalOf([approval, after]);
    expect(approved).toBe(false);
    expect(liftedBy[approval._id]).toEqual({ by: 'Tom' });
  });

  it('is held back by a blocking comment reopened since', () => {
    const blocking = comment({ severity: 'blocking' });
    const approval = comment({ decision: 'approved' });
    const { approved, liftedBy } = approvalOf([blocking, approval]);
    expect(approved).toBe(false);
    expect(liftedBy[approval._id]).toEqual({ blocking: true });
  });

  it('is not lifted by a reply, and the earlier of two approvals says nothing', () => {
    const first = comment({ decision: 'approved' });
    const second = comment({ decision: 'approved' });
    const reply = comment({ _parentComment: second._id });
    expect(approvalOf([first, second, reply])).toEqual({
      approved: true,
      liftedBy: {},
    });
  });
});

describe("a comment's text", () => {
  it('shows mentions by name, the rest as text, never as markup', () => {
    expect(segmentsOf('Hi @[Ana Lee](abc123), <b>see</b>\nthis')).toEqual([
      { text: 'Hi ' },
      { text: '@Ana Lee', mention: true },
      { text: ', <b>see</b>\nthis' },
    ]);
  });

  it('is empty without text', () => {
    expect(segmentsOf('')).toEqual([]);
  });
});
