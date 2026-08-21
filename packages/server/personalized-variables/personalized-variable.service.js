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
  // Scoped by `_group` like the read below: the route guards only check that the
  // caller belongs to the `:groupId` of the URL, never that `:variableId` does.
  // A variable of another company reads as "not found" — we deliberately do not
  // distinguish it from a variable that does not exist.
  const deleted = await PersonalizedVariables.deleteOne({
    _id: variableId,
    _group: mongoose.Types.ObjectId(groupId),
  });

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
  const group = mongoose.Types.ObjectId(groupId);

  await Promise.all(
    variables.map(async (variable) => {
      const { _id, ...otherProperties } = variable;

      // Creation and update are two distinct paths. The UI already tells them
      // apart — it only sends an `_id` for a variable it loaded from the server
      // (see group-personalized-variable-tab.vue) — so no upsert is needed, and
      // an `_id` can never drive the creation of a document.
      if (!_id) {
        const created = await PersonalizedVariables.create({
          ...otherProperties,
          _group: group,
        });

        if (!created) {
          throw new BadRequest(
            ERROR_CODES.PERSONALIZED_VARIABLE_UPDATE_OR_CREATION_FAILED
          );
        }

        logger.log('Created personalized variable:', created._id);
        return;
      }

      // Bounded to the caller's company, like the delete and the read. Without
      // `upsert`, an `_id` that is unknown or belongs to another company updates
      // nothing and creates nothing.
      const updated = await PersonalizedVariables.findOneAndReplace(
        { _id: mongoose.Types.ObjectId(_id), _group: group },
        { ...otherProperties, _group: group },
        { new: true, upsert: false }
      );

      if (!updated) {
        throw new NotFound(ERROR_CODES.PERSONALIZED_VARIABLE_NOT_FOUND);
      }

      logger.log('Updated personalized variable:', _id);
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
