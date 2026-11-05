'use strict';

/**
 * Acceptance tests of the approval as an event of the thread (ADR 0020, and the
 * amendment of ADR 0004).
 *
 * Seam: the comment service and the comment schema's statics, over mocked
 * models, as the rest of tests/server/comment. An approval stays a comment with
 * `decision: 'approved'`, but only who may approve creates one, never over an
 * open blocking comment, without type, priority or block; it counts in no
 * unresolved counter, and "approved" requires no blocking comment open.
 *
 * Turned on by the PR of the approval's server rules.
 */

const mongoose = require('mongoose');

jest.mock('../../../packages/server/common/models.common.js');

const {
  Comments,
  Mailings,
} = require('../../../packages/server/common/models.common.js');
const commentService = require('../../../packages/server/comment/comment.service.js');
const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');
const {
  CommentSchema,
  COMMENT_DECISIONS,
} = require('../../../packages/server/comment/comment.schema.js');

const id = () => new mongoose.Types.ObjectId();
const GROUP = id();
const MAILING = id();

const userOf = (role) => ({
  _id: id(),
  name: 'Relecteur',
  role,
  _company: GROUP,
});

const NOT_AN_APPROVAL = { $ne: COMMENT_DECISIONS.APPROVED };

function mailingAccess() {
  Mailings.findById = jest.fn().mockReturnValue({
    populate: jest.fn().mockResolvedValue({
      _id: MAILING,
      _wireframe: { _company: GROUP },
      data: {
        mainBlocks: { blocks: [{ id: 'ko_textBlock_3', type: 'textBlock' }] },
      },
    }),
  });
}

function openBlocking(count) {
  Comments.countDocuments = jest.fn().mockResolvedValue(count);
}

function created() {
  Comments.create = jest
    .fn()
    .mockImplementation(async (doc) => ({ _id: id(), ...doc }));
  Comments.findById = jest.fn().mockReturnValue({
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue({}),
  });
}

const approve = (role, fields = {}) =>
  commentService.createComment({
    mailingId: MAILING.toString(),
    user: userOf(role),
    text: 'Bon pour envoi',
    decision: COMMENT_DECISIONS.APPROVED,
    ...fields,
  });

beforeEach(() => {
  jest.clearAllMocks();
  mailingAccess();
  openBlocking(0);
  created();
});

describe.skip('approving an email (ADR 0020)', () => {
  describe('who may approve: mailing.approve', () => {
    it.each(['reviewer', 'company_admin', 'company_admin_tech', 'super_admin'])(
      'a %s may',
      async (role) => {
        await approve(role);
        expect(Comments.create).toHaveBeenCalled();
      }
    );

    it.each(['writer', 'regular_user'])('a %s may not', async (role) => {
      await expect(approve(role)).rejects.toMatchObject({
        status: 403,
        message: ERROR_CODES.COMMENT_APPROVAL_FORBIDDEN,
      });
      expect(Comments.create).not.toHaveBeenCalled();
    });

    it('a writer still posts a comment without a decision', async () => {
      await commentService.createComment({
        mailingId: MAILING.toString(),
        user: userOf('writer'),
        text: 'Le prix ne correspond pas',
      });
      expect(Comments.create).toHaveBeenCalled();
    });
  });

  describe('no approval over an open blocking comment', () => {
    it('is refused with 409 while a root blocking comment is unresolved', async () => {
      openBlocking(1);
      await expect(approve('reviewer')).rejects.toMatchObject({
        status: 409,
        message: ERROR_CODES.COMMENT_APPROVAL_BLOCKED,
      });
      expect(Comments.create).not.toHaveBeenCalled();
    });

    it('counts root comments only, and never an approval', async () => {
      await approve('reviewer');
      expect(Comments.countDocuments).toHaveBeenCalledWith({
        _mailing: MAILING.toString(),
        _parentComment: null,
        isDeleted: false,
        resolved: false,
        severity: 'blocking',
        decision: NOT_AN_APPROVAL,
      });
    });

    it('is not checked for a comment without a decision', async () => {
      await commentService.createComment({
        mailingId: MAILING.toString(),
        user: userOf('reviewer'),
        text: 'Une remarque',
      });
      expect(Comments.countDocuments).not.toHaveBeenCalled();
    });
  });

  describe('an approval has no type, no priority and no block', () => {
    it('is stored general, info, on the whole email, whatever is sent', async () => {
      await approve('reviewer', {
        category: 'design',
        severity: 'blocking',
        blockId: 'ko_textBlock_3',
      });
      const stored = Comments.create.mock.calls[0][0];
      expect(stored).toMatchObject({
        category: 'general',
        severity: 'info',
        decision: COMMENT_DECISIONS.APPROVED,
      });
      expect(stored.blockId == null).toBe(true);
      expect(stored.blockSnapshot == null).toBe(true);
    });

    it.each([{ category: 'design' }, { severity: 'blocking' }])(
      'refuses to change %o on an approval',
      async (updates) => {
        const author = userOf('reviewer');
        Comments.findById = jest.fn().mockResolvedValue({
          _id: id(),
          _author: author._id,
          _mailing: MAILING,
          decision: COMMENT_DECISIONS.APPROVED,
          isDeleted: false,
        });
        Comments.findByIdAndUpdate = jest.fn();
        await expect(
          commentService.updateComment({
            commentId: id().toString(),
            user: author,
            updates,
          })
        ).rejects.toMatchObject({
          status: 400,
          message: ERROR_CODES.COMMENT_APPROVAL_FIXED,
        });
        expect(Comments.findByIdAndUpdate).not.toHaveBeenCalled();
      }
    );
  });

  describe('an approval counts nowhere a comment counts', () => {
    it('is left out of the unresolved count of an email', async () => {
      const countDocuments = jest.fn().mockResolvedValue(0);
      await CommentSchema.statics.countUnresolvedByMailing.call(
        { countDocuments },
        MAILING
      );
      expect(countDocuments.mock.calls[0][0]).toMatchObject({
        decision: NOT_AN_APPROVAL,
      });
    });

    it('is left out of the counts per block (the comment markers rail)', async () => {
      const aggregate = jest.fn().mockResolvedValue([]);
      await CommentSchema.statics.getBlockCommentCounts.call(
        { aggregate },
        MAILING.toString()
      );
      expect(aggregate.mock.calls[0][0][0].$match).toMatchObject({
        decision: NOT_AN_APPROVAL,
      });
    });
  });

  describe('an approved email has no blocking comment open', () => {
    it('counts the open blocking root comments in the same aggregation', async () => {
      const aggregate = jest.fn().mockResolvedValue([]);
      await CommentSchema.statics.findApprovedMailingIds.call({ aggregate }, [
        MAILING,
      ]);
      const pipeline = aggregate.mock.calls[0][0];
      const group = pipeline.find((stage) => stage.$group).$group;
      expect(group).toHaveProperty('openBlocking');
      expect(pipeline[pipeline.length - 1]).toEqual({
        $match: { decision: COMMENT_DECISIONS.APPROVED, openBlocking: 0 },
      });
    });
  });
});
