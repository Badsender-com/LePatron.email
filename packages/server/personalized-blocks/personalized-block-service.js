'use strict';

const { PersonalizedBlocks } = require('../common/models.common.js');
const mongoose = require('mongoose');
const ERROR_CODES = require('../constant/error-codes.js');
const { NotFound } = require('http-errors');
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
      _group: mongoose.Types.ObjectId(groupId),
    }).sort({ createdAt: 1 }); // Sorting by creation date in ascending order
  } catch (error) {
    logger.error('Error in getting personalized blocks:', error);
    throw error;
  }
}

async function addPersonalizedBlock(block, groupId, userId) {
  const newBlock = await PersonalizedBlocks.create({
    ...block,
    _group: mongoose.Types.ObjectId(groupId),
    _user: mongoose.Types.ObjectId(userId),
    createdAt: new Date(),
  });

  return newBlock;
}

async function updatePersonalizedBlock(id, groupId, updatedBlock) {
  const updated = await PersonalizedBlocks.findByIdAndUpdate(
    mongoose.Types.ObjectId(id),
    { ...updatedBlock, _group: mongoose.Types.ObjectId(groupId) },
    { new: true } // This option returns the updated document
  );

  if (!updated) {
    throw new NotFound(ERROR_CODES.PERSONALIZED_BLOCK_NOT_FOUND);
  }

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
