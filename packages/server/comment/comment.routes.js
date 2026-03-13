'use strict';

const express = require('express');

const { GUARD_USER } = require('../account/auth.guard.js');
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
mailingCommentsRouter.post('', GUARD_USER, comments.createComment);

// Router for /api/comments/:commentId routes
const commentsRouter = express.Router();

commentsRouter.get('/:commentId', GUARD_USER, comments.getById);
commentsRouter.patch('/:commentId', GUARD_USER, comments.updateComment);
commentsRouter.delete('/:commentId', GUARD_USER, comments.deleteComment);
commentsRouter.patch(
  '/:commentId/resolve',
  GUARD_USER,
  comments.resolveComment
);
commentsRouter.patch(
  '/:commentId/unresolve',
  GUARD_USER,
  comments.unresolveComment
);

module.exports = {
  mailingCommentsRouter,
  commentsRouter,
};
