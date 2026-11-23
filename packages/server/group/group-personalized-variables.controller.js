'use strict';

// A company's personalized variables.

const asyncHandler = require('express-async-handler');
const personalizedVariableService = require('../personalized-variables/personalized-variable.service.js');

module.exports = {
  readPersonalizedVariables: asyncHandler(readPersonalizedVariables),
  createOrUpdatePersonalizedVariables: asyncHandler(
    createOrUpdatePersonalizedVariables
  ),
  deletePersonalizedVariable: asyncHandler(deletePersonalizedVariable),
};

/**
 * @api {get} /groups/:groupId/personalized-variables get personalized variables for a group
 * @apiPermission group-admin or group-user
 * @apiName GetPersonalizedVariables
 * @apiGroup Groups
 *
 * @apiParam {string} groupId
 *
 * @apiSuccess {Object[]} items list of personalized variables
 */

async function readPersonalizedVariables(req, res) {
  const { groupId } = req.params;
  const variables = await personalizedVariableService.getGroupPersonalizedVariables(
    groupId
  );
  res.json({ items: variables });
}

/**
 * @api {post} /groups/:groupId/personalized-variables create or update personalized variables for a group
 * @apiPermission admin
 * @apiName createOrUpdatePersonalizedVariable
 * @apiGroup Groups
 *
 * @apiParam {string} groupId
 * @apiParam (Body) {Object[]} personalizedVariables array of personalized variables
 * @apiParam (Body) {String} personalizedVariables[].label the label of the personalized variable
 * @apiParam (Body) {String} personalizedVariables[].variable the variable of the personalized variable
 *
 * @apiSuccess {Object[]} items list of created personalized variables
 */

async function createOrUpdatePersonalizedVariables(req, res) {
  const { groupId } = req.params;
  const { personalizedVariables } = req.body;
  const createdVariables = await personalizedVariableService.createOrUpdatePersonalizedVariables(
    personalizedVariables,
    groupId
  );
  res.json({ items: createdVariables });
}

/**
 * @api {delete} /groups/:groupId/personalized-variables/:variableId delete personalized variable from a group
 * @apiPermission admin
 * @apiName DeletePersonalizedVariable
 * @apiGroup Groups
 *
 * @apiParam {string} groupId
 * @apiParam {string} variableId
 *
 * @apiSuccess {Object} result deletion result
 */

async function deletePersonalizedVariable(req, res) {
  const { groupId, variableId } = req.params;
  const result = await personalizedVariableService.deletePersonalizedVariable(
    variableId,
    groupId
  );
  res.json(result);
}
