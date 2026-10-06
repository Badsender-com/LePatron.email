'use strict';

const mongoose = require('mongoose');
const {
  CommentSchema,
  COMMENT_DECISIONS,
} = require('../../../packages/server/comment/comment.schema.js');

// The listing's green check: a mailing is approved when its LATEST root comment
// is an approval (a later comment, whatever it says, lifts it).
describe('CommentSchema.statics.findApprovedMailingIds', () => {
  const ids = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];

  it('looks at the latest non-deleted root comment of each mailing', async () => {
    const aggregate = jest.fn().mockResolvedValue([]);
    await CommentSchema.statics.findApprovedMailingIds.call({ aggregate }, ids);

    const pipeline = aggregate.mock.calls[0][0];
    expect(pipeline[0].$match).toEqual({
      _mailing: { $in: ids },
      _parentComment: null,
      isDeleted: false,
    });
    expect(pipeline[1]).toEqual({ $sort: { createdAt: -1 } });
    expect(pipeline[2].$group).toEqual({
      _id: '$_mailing',
      decision: { $first: '$decision' },
    });
    expect(pipeline[3]).toEqual({
      $match: { decision: COMMENT_DECISIONS.APPROVED },
    });
  });

  it('returns the mailing ids as strings', async () => {
    const aggregate = jest.fn().mockResolvedValue([{ _id: ids[0] }]);
    const result = await CommentSchema.statics.findApprovedMailingIds.call(
      { aggregate },
      ids
    );
    expect(result).toEqual([ids[0].toString()]);
  });
});
