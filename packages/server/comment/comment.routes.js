'use strict';

const express = require('express');

const { GUARD_USER } = require('../account/auth.guard.js');
const comments = require('./comment.controller.js');

// Router for /api/mailings/:mailingId/comments routes
const mailingCommentsRouter = express.Router({ mergeParams: true });

mailingCommentsRouter.get('', GUARD_USER, comments.list);
mailingCommentsRouter.get('/counts', GUARD_USER, comments.getCounts);
mailingCommentsRouter.get('/unresolved-count', GUARD_USER, comments.getUnresolvedCount);
mailingCommentsRouter.post('', GUARD_USER, comments.create);

// Router for /api/comments/:commentId routes
const commentsRouter = express.Router();

commentsRouter.get('/:commentId', GUARD_USER, comments.getById);
commentsRouter.patch('/:commentId', GUARD_USER, comments.update);
commentsRouter.delete('/:commentId', GUARD_USER, comments.remove);
commentsRouter.patch('/:commentId/resolve', GUARD_USER, comments.resolve);

module.exports = {
  mailingCommentsRouter,
  commentsRouter,
};
