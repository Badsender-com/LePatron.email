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

async function existsById(id) {
  return PersonalizedVariables.exists({ _id: mongoose.Types.ObjectId(id) });
}

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
      console.log({ variable });
      if (await existsById(variable._id)) {
        const { _id, ...otherProperties } = variable;
        const updated = await PersonalizedVariables.updateOne(
          { _id: mongoose.Types.ObjectId(_id) },
          {
            ...otherProperties,
            _group: {
              _id: groupId,
            },
          }
        );

        if (updated.nModified === 0) {
          throw new BadRequest(ERROR_CODES.PERSONALIZED_VARIABLE_UPDATE_FAILED);
        }

        logger.log('Updating personalized variable:', _id);
      } else {
        const createdVariable = await PersonalizedVariables.create({
          ...variable,
          _group: {
            _id: groupId,
          },
        });

        if (!createdVariable) {
          throw new BadRequest(
            ERROR_CODES.PERSONALIZED_VARIABLE_CREATION_FAILED
          );
        }

        logger.log('Creating personalized variable:', variable);
      }
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
