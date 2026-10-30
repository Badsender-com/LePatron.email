'use strict';

const asyncHandler = require('express-async-handler');
const { omit } = require('lodash');

const dimensionService = require('../services/dimension.service.js');

module.exports = {
  listDimensions: asyncHandler(listDimensions),
  createDimension: asyncHandler(createDimension),
  updateDimension: asyncHandler(updateDimension),
  deleteDimension: asyncHandler(deleteDimension),
};

/**
 * @api {get} /taxonomy-dimensions list the company's dimensions
 * @apiPermission group_admin
 * @apiName ListDimensions
 * @apiGroup TaxonomyDimensions
 *
 * @apiParam (Query) {String} [groupId] super admin only, the target company
 * @apiParam (Query) {String} [lang] `fr` or `en`, the language the screen is
 *   displayed in: the email type and the trigger are seeded in it on first read
 *
 * @apiUse taxonomyDimension
 * @apiSuccess {taxonomyDimension[]} items in display order
 */
async function listDimensions(req, res) {
  const dimensions = await dimensionService.listDimensions({
    user: req.user,
    groupId: req.query.groupId,
    lang: req.query.lang,
  });

  res.json({ items: dimensions.map(expose) });
}

/**
 * @api {post} /taxonomy-dimensions declare a dimension of the company
 * @apiPermission group_admin
 * @apiName CreateDimension
 * @apiGroup TaxonomyDimensions
 *
 * @apiParam (Body) {String} [groupId] super admin only, the target company
 * @apiParam (Body) {String} name what templates will read, write-once
 * @apiParam (Body) {String} label
 * @apiParam (Body) {String} [description]
 * @apiParam (Body) {Number} [order]
 * @apiParam (Body) {Number} [precedence]
 *
 * @apiUse taxonomyDimension
 */
async function createDimension(req, res) {
  const { groupId, ...payload } = req.body;

  const dimension = await dimensionService.createDimension({
    user: req.user,
    groupId,
    payload,
  });

  res.json(expose(dimension));
}

/**
 * @api {patch} /taxonomy-dimensions/:dimensionId edit a dimension
 * @apiPermission group_admin
 * @apiName UpdateDimension
 * @apiGroup TaxonomyDimensions
 *
 * @apiDescription Everything but the name, which templates read. A standard
 *   dimension cannot be deactivated.
 *
 * @apiUse taxonomyDimension
 */
async function updateDimension(req, res) {
  const dimension = await dimensionService.updateDimension({
    user: req.user,
    dimensionId: req.params.dimensionId,
    payload: omit(req.body, ['groupId']),
  });

  res.json(expose(dimension));
}

/**
 * @api {delete} /taxonomy-dimensions/:dimensionId delete a dimension
 * @apiPermission group_admin
 * @apiName DeleteDimension
 * @apiGroup TaxonomyDimensions
 *
 * @apiDescription Refused with a 409 for a standard dimension, and for one that
 *   has values: deactivate it instead.
 */
async function deleteDimension(req, res) {
  await dimensionService.deleteDimension({
    user: req.user,
    dimensionId: req.params.dimensionId,
  });

  res.status(204).send();
}

// What travels out: never `_company`.
function expose(dimension) {
  return {
    id: String(dimension._id),
    name: dimension.name,
    label: dimension.label,
    description: dimension.description,
    standard: Boolean(dimension.standard),
    isActive: dimension.isActive,
    order: dimension.order,
    precedence: dimension.precedence,
  };
}
