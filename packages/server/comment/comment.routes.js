'use strict';

const express = require('express');

const { GUARD_USER, GUARD_CAN } = require('../account/auth.guard.js');
const { CAPABILITIES: C } = require('../../shared/access/roles.js');
const comments = require('./comment.controller.js');

// Router for /api/mailings/:mailingId/comments routes
const mailingCommentsRouter = express.Router({ mergeParams: true });

mailingCommentsRouter.get('', GUARD_USER, comments.getByMailing);
mailingCommentsRouter.get(
  '/counts',
  GUARD_USER,
  comments.getBlockCommentCounts
);
mailingCommentsRouter.get(
  '/unresolved-count',
  GUARD_USER,
  comments.getUnresolvedCountByMailing
);
mailingCommentsRouter.post(
  '',
  GUARD_CAN(C.MAILING_COMMENT),
  comments.createComment
);

// Router for /api/comments/:commentId routes
const commentsRouter = express.Router();

commentsRouter.get('/:commentId', GUARD_USER, comments.getById);
commentsRouter.patch(
  '/:commentId',
  GUARD_CAN(C.MAILING_COMMENT),
  comments.updateComment
);
commentsRouter.delete(
  '/:commentId',
  GUARD_CAN(C.MAILING_COMMENT),
  comments.deleteComment
);
commentsRouter.patch(
  '/:commentId/resolve',
  GUARD_CAN(C.MAILING_COMMENT),
  comments.resolveComment
);
commentsRouter.patch(
  '/:commentId/unresolve',
  GUARD_CAN(C.MAILING_COMMENT),
  comments.unresolveComment
);

module.exports = {
  mailingCommentsRouter,
  commentsRouter,
};
