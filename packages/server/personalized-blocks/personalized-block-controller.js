'use strict';

const asyncHandler = require('express-async-handler');
const ERROR_CODES = require('../constant/error-codes.js');
const personalizedBlockService = require('./personalized-block-service');
const createHttpError = require('http-errors');

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
  const { groupId, searchTerm } = req.query;
  if (!groupId) {
    return next(new createHttpError.BadRequest(ERROR_CODES.GROUP_ID_REQUIRED));
  }

  const personalizedBlocks = await personalizedBlockService.getPersonalizedBlocks(
    groupId,
    searchTerm
  );
  return res.json({ items: personalizedBlocks });
}

/**
 * @api {post} /personalized-blocks personalized block creation
 * @apiPermission group_admin
 * @apiName CreatePersonalizedBlock
 * @apiGroup PersonalizedBlocks
 *
 * @apiParam (Body) {String} groupId the group of the personalized block
 * @apiParam (Body) {String} name name of the block
 * @apiParam (Body) {String} category category of the block
 * @apiParam (Body) {Mixed} content content of the block
 *
 * @apiUse personalizedBlock
 * @apiSuccess {personalizedBlock} personalizedBlock created
 */
async function createPersonalizedBlock(req, res, next) {
  const { groupId, name, category, content } = req.body;
  const { user } = req;

  if (!groupId || !name || !content) {
    return next(
      new createHttpError.BadRequest(
        ERROR_CODES.MISSING_PARAMETERS_PERSONALIZED_BLOCK
      )
    );
  }

  const newPersonalizedBlock = await personalizedBlockService.addPersonalizedBlock(
    { name, category, content },
    groupId,
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

  try {
    await personalizedBlockService.deletePersonalizedBlock(id);
    res.status(204).send();
  } catch (error) {
    if (error.status) {
      return res.status(error.status).send(error.message);
    }
    res.status(500).send();
  }
}
