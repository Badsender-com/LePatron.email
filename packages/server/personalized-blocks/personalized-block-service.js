'use strict';

const { PersonalizedBlocks } = require('../common/models.common.js');
const mongoose = require('mongoose');
const ERROR_CODES = require('../constant/error-codes.js');
const { NotFound, Conflict } = require('http-errors');
const logger = require('../utils/logger');

module.exports = {
  getPersonalizedBlocks,
  addPersonalizedBlock,
  updatePersonalizedBlock,
  deletePersonalizedBlock,
};

async function getPersonalizedBlocks(groupId) {
  try {
    return await PersonalizedBlocks.find({
      groupId: mongoose.Types.ObjectId(groupId),
    }).sort({ createdAt: 1 }); // Sorting by creation date in ascending order
  } catch (error) {
    logger.error('Error in getting personalized blocks:', error);
    throw error;
  }
}

async function addPersonalizedBlock(block, groupId, userId) {
  const { name } = block;

  if (await PersonalizedBlocks.exists({ name, groupId })) {
    throw new Conflict(ERROR_CODES.PERSONALIZED_BLOCK_ALREADY_EXISTS);
  }

  const newBlock = await PersonalizedBlocks.create({
    ...block,
    _group: {
      _id: groupId,
    },
    _user: {
      _id: userId,
    },
    createdAt: new Date(),
  });

  return newBlock;
}

async function updatePersonalizedBlock(id, updatedBlock) {
  const existingBlock = await PersonalizedBlocks.findById(id);

  if (!existingBlock) {
    throw new NotFound(ERROR_CODES.PERSONALIZED_BLOCK_NOT_FOUND);
  }

  const { name, groupId } = updatedBlock;

  if (
    name !== existingBlock.name &&
    (await PersonalizedBlocks.exists({ name, groupId }))
  ) {
    throw new Conflict(ERROR_CODES.PERSONALIZED_BLOCK_ALREADY_EXISTS);
  }

  const updated = await PersonalizedBlocks.updateOne(
    { _id: mongoose.Types.ObjectId(id) },
    { ...updatedBlock }
  );

  return updated;
}

async function deletePersonalizedBlock(blockId, groupId) {
  const deleted = await PersonalizedBlocks.deleteOne({
    _id: mongoose.Types.ObjectId(blockId),
  });

  if (deleted.deletedCount === 0) {
    throw new NotFound(ERROR_CODES.PERSONALIZED_BLOCK_NOT_FOUND);
  }

  logger.log('Deleted personalized block:', blockId, 'from the group', groupId);
}
