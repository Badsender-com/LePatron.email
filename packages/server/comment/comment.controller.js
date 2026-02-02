'use strict';

const asyncHandler = require('express-async-handler');
const { BadRequest } = require('http-errors');

const commentService = require('./comment.service.js');
const ERROR_CODES = require('../constant/error-codes.js');

module.exports = {
  list: asyncHandler(list),
  getCounts: asyncHandler(getCounts),
  getUnresolvedCount: asyncHandler(getUnresolvedCount),
  getById: asyncHandler(getById),
  create: asyncHandler(create),
  update: asyncHandler(update),
  remove: asyncHandler(remove),
  resolve: asyncHandler(resolve),
};

/**
 * @api {get} /mailings/:mailingId/comments list comments for a mailing
 * @apiPermission user
 * @apiName GetComments
 * @apiGroup Comments
 *
 * @apiParam {String} mailingId Mailing ID
 * @apiQuery {String} [blockId] Filter by block ID
 * @apiQuery {Boolean} [resolved] Filter by resolution status
 * @apiQuery {Boolean} [includeReplies=true] Include reply comments
 *
 * @apiSuccess {Comment[]} items List of comments
 */
async function list(req, res) {
  const {
    params: { mailingId },
    query: { blockId, resolved, includeReplies },
  } = req;

  const comments = await commentService.findByMailing({
    mailingId,
    blockId,
    resolved: resolved !== undefined ? resolved === 'true' : undefined,
    includeReplies: includeReplies !== 'false',
  });

  res.json({ items: comments });
}

/**
 * @api {get} /mailings/:mailingId/comments/counts get comment counts per block
 * @apiPermission user
 * @apiName GetCommentCounts
 * @apiGroup Comments
 *
 * @apiParam {String} mailingId Mailing ID
 *
 * @apiSuccess {Object} counts Object with blockId keys and count values
 */
async function getCounts(req, res) {
  const { mailingId } = req.params;

  const counts = await commentService.getBlockCommentCounts(mailingId);

  res.json({ counts });
}

/**
 * @api {get} /mailings/:mailingId/comments/unresolved-count get unresolved count
 * @apiPermission user
 * @apiName GetUnresolvedCount
 * @apiGroup Comments
 *
 * @apiParam {String} mailingId Mailing ID
 *
 * @apiSuccess {Number} count Unresolved comment count
 */
async function getUnresolvedCount(req, res) {
  const { mailingId } = req.params;

  const count = await commentService.getUnresolvedCountByMailing(mailingId);

  res.json({ count });
}

/**
 * @api {get} /comments/:commentId get comment by ID
 * @apiPermission user
 * @apiName GetComment
 * @apiGroup Comments
 *
 * @apiParam {String} commentId Comment ID
 *
 * @apiSuccess {Comment} comment
 */
async function getById(req, res) {
  const { commentId } = req.params;

  const comment = await commentService.findById(commentId);

  res.json(comment);
}

/**
 * @api {post} /mailings/:mailingId/comments create a comment
 * @apiPermission user
 * @apiName CreateComment
 * @apiGroup Comments
 *
 * @apiParam {String} mailingId Mailing ID
 *
 * @apiParam (Body) {String} text Comment text (required)
 * @apiParam (Body) {String} [blockId] Block ID to attach comment to
 * @apiParam (Body) {String} [category=general] Category (design, content, general)
 * @apiParam (Body) {String} [severity=info] Severity (info, important, blocking)
 * @apiParam (Body) {String} [parentCommentId] Parent comment ID for replies
 * @apiParam (Body) {String[]} [mentions] Array of user IDs to mention
 *
 * @apiSuccess {Comment} comment Created comment
 */
async function create(req, res) {
  const {
    user,
    params: { mailingId },
    body: { text, blockId, category, severity, parentCommentId, mentions },
  } = req;

  if (!text || text.trim() === '') {
    throw new BadRequest(ERROR_CODES.COMMENT_TEXT_REQUIRED);
  }

  const comment = await commentService.createComment({
    mailingId,
    user,
    blockId,
    text: text.trim(),
    category,
    severity,
    parentCommentId,
    mentions,
  });

  res.status(201).json(comment);
}

/**
 * @api {patch} /comments/:commentId update a comment
 * @apiPermission user (author only)
 * @apiName UpdateComment
 * @apiGroup Comments
 *
 * @apiParam {String} commentId Comment ID
 *
 * @apiParam (Body) {String} [text] Updated text
 * @apiParam (Body) {String} [category] Updated category
 * @apiParam (Body) {String} [severity] Updated severity
 * @apiParam (Body) {String[]} [mentions] Updated mentions
 *
 * @apiSuccess {Comment} comment Updated comment
 */
async function update(req, res) {
  const {
    user,
    params: { commentId },
    body,
  } = req;

  const updates = {};
  if (body.text !== undefined) updates.text = body.text.trim();
  if (body.category !== undefined) updates.category = body.category;
  if (body.severity !== undefined) updates.severity = body.severity;
  if (body.mentions !== undefined) updates.mentions = body.mentions;

  const comment = await commentService.updateComment({
    commentId,
    user,
    updates,
  });

  res.json(comment);
}

/**
 * @api {delete} /comments/:commentId delete a comment
 * @apiPermission user (author or group admin)
 * @apiName DeleteComment
 * @apiGroup Comments
 *
 * @apiParam {String} commentId Comment ID
 *
 * @apiSuccess {Object} result Deletion result
 */
async function remove(req, res) {
  const {
    user,
    params: { commentId },
  } = req;

  const result = await commentService.deleteComment({ commentId, user });

  res.json(result);
}

/**
 * @api {patch} /comments/:commentId/resolve mark comment as resolved
 * @apiPermission user
 * @apiName ResolveComment
 * @apiGroup Comments
 *
 * @apiParam {String} commentId Comment ID
 *
 * @apiSuccess {Comment} comment Resolved comment
 */
async function resolve(req, res) {
  const {
    user,
    params: { commentId },
  } = req;

  const comment = await commentService.resolveComment({ commentId, user });

  res.json(comment);
}
