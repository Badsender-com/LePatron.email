'use strict';

const asyncHandler = require('express-async-handler');
const ERROR_CODES = require('../constant/error-codes.js');
const personalizedBlockService = require('./personalized-block-service');
const createHttpError = require('http-errors');
const { Templates } = require('../common/models.common.js');
const {
  TEMPLATE_FLAG_PROJECTION,
  syntheticBlockFlagsOf,
} = require('../mailing/synthetic-block-guard.js');
const { BLOCK_BUILDER_BLOCK } = require('../../shared/synthetic-blocks.js');
const { can } = require('../account/permissions.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');

module.exports = {
  listPersonalizedBlocks: asyncHandler(listPersonalizedBlocks),
  createPersonalizedBlock: asyncHandler(createPersonalizedBlock),
  updatePersonalizedBlock: asyncHandler(updatePersonalizedBlock),
  deletePersonalizedBlock: asyncHandler(deletePersonalizedBlock),
};

/**
 * @api {get} /personalized-blocks list of personalized blocks
 * @apiPermission group_admin
 * @apiName GetPersonalizedBlocks
 * @apiGroup PersonalizedBlocks
 *
 * @apiUse personalizedBlock
 * @apiSuccess {personalizedBlock[]} items list of personalized blocks
 */
async function listPersonalizedBlocks(req, res, next) {
  const { groupId, templateId, searchTerm } = req.query;
  if (!groupId || !templateId) {
    return next(
      new createHttpError.BadRequest(
        ERROR_CODES.GROUP_ID_AND_TEMPLATE_ID_REQUIRED
      )
    );
  }

  const personalizedBlocks = await personalizedBlockService.getPersonalizedBlocks(
    groupId,
    templateId,
    searchTerm
  );
  const offersComposed = await offersComposedBlocks(req.user, templateId);
  return res.json({
    items: offersComposed
      ? personalizedBlocks
      : personalizedBlocks.filter((block) => !isComposed(block)),
  });
}

const isComposed = (block) =>
  Boolean(block.content) && block.content.type === BLOCK_BUILDER_BLOCK.type;

/**
 * Whether the list may offer composed blocks (ADR 0027): only those the email
 * save would accept. A composed block inserted under a template whose Block
 * Builder is off, or by someone who may not compose, is a new composition the
 * save refuses — the whole save, after the user has worked. Hidden, never
 * deleted: turning the builder back on brings them back.
 *
 * @param {Object} user
 * @param {string} templateId
 * @returns {Promise<boolean>}
 */
async function offersComposedBlocks(user, templateId) {
  if (!can(user, CAPABILITIES.BLOCK_COMPOSE)) return false;
  const template = await Templates.findById(templateId)
    .select(TEMPLATE_FLAG_PROJECTION)
    .lean();
  return syntheticBlockFlagsOf(template)[BLOCK_BUILDER_BLOCK.flag];
}

/**
 * @api {post} /personalized-blocks personalized block creation
 * @apiPermission group_admin
 * @apiName CreatePersonalizedBlock
 * @apiGroup PersonalizedBlocks
 *
 * @apiParam (Body) {String} groupId the group of the personalized block
 * @apiParam (Body) {String} templateId the template of the personalized block
 * @apiParam (Body) {String} name name of the block
 * @apiParam (Body) {String} category category of the block
 * @apiParam (Body) {Mixed} content content of the block
 *
 * @apiUse personalizedBlock
 * @apiSuccess {personalizedBlock} personalizedBlock created
 */
async function createPersonalizedBlock(req, res, next) {
  const { groupId, templateId, name, category, content } = req.body;
  const { user } = req;

  if (!groupId || !templateId || !name || !content) {
    return next(
      new createHttpError.BadRequest(
        ERROR_CODES.MISSING_PARAMETERS_PERSONALIZED_BLOCK
      )
    );
  }

  const newPersonalizedBlock = await personalizedBlockService.addPersonalizedBlock(
    { name, category, content },
    groupId,
    templateId,
    user.id
  );

  res.json(newPersonalizedBlock);
}

/**
 * @api {put} /personalized-blocks/:id personalized block update
 * @apiPermission group_admin
 * @apiName UpdatePersonalizedBlock
 * @apiGroup PersonalizedBlocks
 *
 * @apiParam {String} id ID of the personalized block
 *
 * @apiUse personalizedBlock
 * @apiSuccess {personalizedBlock} personalizedBlock updated
 */
async function updatePersonalizedBlock(req, res) {
  const { id } = req.params;
  const { groupId, ...updatedBlock } = req.body;

  try {
    const updatedBlockResult = await personalizedBlockService.updatePersonalizedBlock(
      id,
      groupId,
      updatedBlock
    );
    res.json(updatedBlockResult);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).send(error.message);
    }
    res.status(500).send();
  }
}

/**
 * @api {delete} /personalized-blocks/:id personalized block delete
 * @apiPermission group_admin
 * @apiName DeletePersonalizedBlock
 * @apiGroup PersonalizedBlocks
 *
 * @apiParam {String} id ID of the personalized block
 *
 * @apiUse personalizedBlock
 * @apiSuccess {personalizedBlock} personalizedBlock deleted
 */
async function deletePersonalizedBlock(req, res) {
  const { id } = req.params;
  const { groupId } = req.query;

  try {
    await personalizedBlockService.deletePersonalizedBlock(id, groupId);
    res.status(204).send();
  } catch (error) {
    if (error.status) {
      return res.status(error.status).send(error.message);
    }
    res.status(500).send();
  }
}
