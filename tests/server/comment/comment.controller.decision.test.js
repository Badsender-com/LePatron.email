'use strict';

// A decision is one of the known values, on the first comment of a thread:
// the listing reads the last root comment of an email, so a decision on a
// reply would be stored and never count, and an unknown value used to reach
// the database and come back as a server error.

jest.mock('../../../packages/server/comment/comment.service.js', () => ({
  createComment: jest.fn().mockResolvedValue({ id: 'c1' }),
}));

const commentService = require('../../../packages/server/comment/comment.service.js');
const controller = require('../../../packages/server/comment/comment.controller.js');

function create(body) {
  return new Promise((resolve) => {
    const res = {
      status: (status) => ({ json: () => resolve({ status }) }),
    };
    controller.createComment(
      { user: { id: 'u1' }, params: { mailingId: 'm1' }, body },
      res,
      resolve
    );
  });
}

beforeEach(() => jest.clearAllMocks());

describe('POST /mailings/:mailingId/comments — decision', () => {
  it.each([undefined, null, 'approved', 'changes_requested'])(
    'accepts %s on a thread',
    async (decision) => {
      expect(await create({ text: 'ok', decision })).toEqual({ status: 201 });
    }
  );

  it.each([
    ['an unknown value', { decision: 'validated' }],
    ['something else than text', { decision: { $ne: null } }],
    ['a decision on a reply', { decision: 'approved', parentCommentId: 'c0' }],
  ])('refuses %s', async (_label, body) => {
    expect(await create({ text: 'ok', ...body })).toMatchObject({
      status: 400,
      message: 'COMMENT_INVALID_DECISION',
    });
    expect(commentService.createComment).not.toHaveBeenCalled();
  });
});
