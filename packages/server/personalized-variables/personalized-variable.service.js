'use strict';

const { PersonalizedVariables } = require('../common/models.common.js');
const mongoose = require('mongoose');
const ERROR_CODES = require('../constant/error-codes.js');
const { NotFound } = require('http-errors');
const logger = require('../utils/logger');

module.exports = {
  createOrUpdatePersonalizedVariables,
  deletePersonalizedVariable,
  getGroupPersonalizedVariables,
};

async function deletePersonalizedVariable(variableId, groupId) {
  // Scoped by `_group` like the read below: the route guards only check that the
  // caller belongs to the `:groupId` of the URL, never that `:variableId` does.
  // A variable of another company reads as "not found" — deliberately
  // indistinguishable from one that does not exist.
  const deleted = await PersonalizedVariables.deleteOne({
    _id: mongoose.Types.ObjectId(variableId),
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

  // Checked before any write: the payload is a batch, so a rejected item would
  // otherwise leave the items written before it in the collection while the
  // caller gets an error — and the retry that follows duplicates them.
  await assertVariablesBelongToGroup(variables, group);

  await Promise.all(
    variables.map(async (variable) => {
      const { _id, ...otherProperties } = variable;

      // The UI only sends an `_id` for a variable it loaded from the server
      // (see group-personalized-variable-tab.vue), so creation and update are
      // two distinct paths and no upsert is needed.
      if (!_id) {
        const created = await PersonalizedVariables.create({
          ...otherProperties,
          _group: group,
        });

        logger.log('Created personalized variable:', created._id);
        return;
      }

      const updated = await PersonalizedVariables.findOneAndReplace(
        { _id: mongoose.Types.ObjectId(_id), _group: group },
        { ...otherProperties, _group: group },
        { new: true, upsert: false }
      );

      // Ownership is already established above; this only catches a concurrent
      // delete between the check and the write.
      if (!updated) {
        throw new NotFound(ERROR_CODES.PERSONALIZED_VARIABLE_NOT_FOUND);
      }

      logger.log('Updated personalized variable:', _id);
    })
  );
}

// An `_id` that is unknown, or that belongs to another company, is reported as
// `NotFound` — the same answer either way.
async function assertVariablesBelongToGroup(variables, group) {
  const ids = [
    ...new Set(
      variables.filter(({ _id }) => _id).map(({ _id }) => String(_id))
    ),
  ];

  if (ids.length === 0) {
    return;
  }

  const owned = await PersonalizedVariables.find(
    {
      _id: { $in: ids.map((id) => mongoose.Types.ObjectId(id)) },
      _group: group,
    },
    '_id'
  );

  if (owned.length !== ids.length) {
    throw new NotFound(ERROR_CODES.PERSONALIZED_VARIABLE_NOT_FOUND);
  }
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
