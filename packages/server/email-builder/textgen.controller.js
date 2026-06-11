'use strict';

const asyncHandler = require('express-async-handler');
const createError = require('http-errors');

const textgenService = require('./textgen.service.js');

/**
 * @api {post} /email-builder/textgen/block Generate a block's text content (POC)
 * @apiPermission user
 * @apiName GenerateBlockText
 * @apiGroup EmailBuilder
 *
 * @apiParam (Body) {String} instruction Free-form user brief
 * @apiParam (Body) {Array} currentContent [{ path, value }] text fields of the block
 * @apiParam (Body) {String} [fieldConstraints] Free-form field constraints
 *
 * @apiSuccess {Array} generated [{ path, value }] new content (paths ⊆ input paths)
 * @apiSuccess {String[]} omittedPaths input paths the model did not cover
 */
module.exports = {
  generateBlockText: asyncHandler(async (req, res) => {
    const { instruction, currentContent, fieldConstraints } = req.body || {};
    if (!instruction || typeof instruction !== 'string') {
      throw createError(400, 'instruction is required');
    }
    if (!Array.isArray(currentContent) || !currentContent.length) {
      throw createError(400, 'currentContent must be a non-empty array');
    }

    // Regular users are locked to their own group; the super-admin pseudo-user
    // has no group, so it may target the mailing's group (sent by the editor
    // from metadata.groupId) — demo case on the platform group.
    const ownGroupId = req.user.group && req.user.group.id;
    const groupId = req.user.isAdmin
      ? req.body.groupId || ownGroupId
      : ownGroupId;

    const result = await textgenService.generateBlockText({
      groupId,
      userId: req.user.isAdmin ? null : req.user.id,
      instruction,
      currentContent,
      fieldConstraints,
    });
    res.json(result);
  }),
};
