'use strict';

const { PersonalizedVariables } = require('../common/models.common.js');
const mongoose = require('mongoose');
const ERROR_CODES = require('../constant/error-codes.js');
const { NotFound, BadRequest } = require('http-errors');
const logger = require('../utils/logger');

module.exports = {
  createOrUpdatePersonalizedVariables,
  deletePersonalizedVariable,
  getGroupPersonalizedVariables,
};

async function deletePersonalizedVariable(variableId, groupId) {
  const deleted = await PersonalizedVariables.deleteOne({ _id: variableId });

  if (deleted.deletedCount === 0) {
    throw new NotFound(ERROR_CODES.PERSONALIZED_VARIABLE_NOT_FOUND);
  }

  logger.log(
    'Deleted personalized variable:',
    variableId,
    'from the group',
    groupId
  );
}

async function createOrUpdatePersonalizedVariables(variables, groupId) {
  await Promise.all(
    variables.map(async (variable) => {
      const { _id, ...otherProperties } = variable;

      const options = {
        new: true, // Returns the document after the update
        upsert: true, // Creates the document if it doesn't exist
        returnOriginal: false, // Equivalent to 'new: true', returns the document after the update
      };

      const replacement = {
        ...otherProperties,
        _group: {
          _id: groupId,
        },
      };

      const updatedOrCreated = await PersonalizedVariables.findOneAndReplace(
        { _id: mongoose.Types.ObjectId(_id) },
        replacement,
        options
      );

      if (!updatedOrCreated) {
        throw new BadRequest(
          ERROR_CODES.PERSONALIZED_VARIABLE_UPDATE_OR_CREATION_FAILED
        );
      }

      logger.log(
        updatedOrCreated.updatedExisting
          ? 'Updated personalized variable:'
          : 'Created personalized variable:',
        _id
      );
    })
  );
}

async function getGroupPersonalizedVariables(groupId) {
  try {
    return await PersonalizedVariables.find({
      _group: mongoose.Types.ObjectId(groupId),
    });
  } catch (error) {
    logger.error('Error in getting group personalized variables:', error);
    throw error;
  }
}
