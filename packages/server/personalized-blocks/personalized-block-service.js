'use strict';

const { PersonalizedBlocks, Users } = require('../common/models.common.js');
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

async function getPersonalizedBlocks(groupId, templateId, searchTerm = '') {
  try {
    // Initialize MongoDB aggregation query
    const query = [];

    // Step 1: Filter personalized blocks by group and by template
    query.push({
      $match: {
        _group: mongoose.Types.ObjectId(groupId),
        _template: mongoose.Types.ObjectId(templateId),
      },
    });

    // Step 2: Join the "Users" collection to get details of the user who created each block
    query.push({
      $lookup: {
        from: Users.collection.name, // Use the collection name from the Users model
        localField: '_user', // Local field for the join
        foreignField: '_id', // Foreign field for the join
        as: 'userDetails', // Store the user details in the field "userDetails"
      },
    });

    // Step 3: Unwind the "userDetails" arrays to directly access user fields
    query.push({
      $unwind: {
        path: '$userDetails',
        preserveNullAndEmptyArrays: true, // This will keep the documents in the pipeline even if "userDetails" is empty or null
      },
    });

    // Step 4: Conditionally filter results based on the search term
    if (searchTerm) {
      query.push({
        // Search in the "name" field of users
        // Search in the "name" field of blocks
        // Search in the "category" field of blocks
        // The 'i' option makes the search case-insensitive "block" will match "Block", "BLOCK", and "bLoCk".
        $match: {
          $or: [
            { name: { $regex: searchTerm, $options: 'i' } },
            { category: { $regex: searchTerm, $options: 'i' } },
            { 'userDetails.name': { $regex: searchTerm, $options: 'i' } },
          ],
        },
      });
    }

    // Sorting: Sort the blocks by creation date in ascending order
    query.push({ $sort: { createdAt: 1 } });

    // Execute the query
    return await PersonalizedBlocks.aggregate(query);
  } catch (error) {
    logger.error('Error in getting personalized blocks:', error);
    throw error;
  }
}

async function addPersonalizedBlock(block, groupId, templateId, userId) {
  const newBlock = await PersonalizedBlocks.create({
    ...block,
    _group: mongoose.Types.ObjectId(groupId),
    _user: mongoose.Types.ObjectId(userId),
    _template: mongoose.Types.ObjectId(templateId),
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
