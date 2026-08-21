'use strict';

const asyncHandler = require('express-async-handler');

const taxonomyService = require('./taxonomy.service.js');
const { TaxonomyTypes } = require('../constant/taxonomy-type.js');

module.exports = {
  listTaxonomyItems: asyncHandler(listTaxonomyItems),
  listTaxonomyItemsForGroup: asyncHandler(listTaxonomyItemsForGroup),
  createTaxonomyItem: asyncHandler(createTaxonomyItem),
  updateTaxonomyItem: asyncHandler(updateTaxonomyItem),
  deleteTaxonomyItem: asyncHandler(deleteTaxonomyItem),
};

// Phase 1 has a single taxonomy, so a caller that does not name one gets it.
// Kept explicit rather than hidden in the service: when `language` or `brand`
// arrive, an unnamed type must stop meaning "email type".
const DEFAULT_TYPE = TaxonomyTypes.EMAIL_TYPE;

const wantsActiveOnly = (req) => req.query.activeOnly === 'true';

/**
 * @api {get} /taxonomy-items list the caller company's taxonomy items
 * @apiPermission user
 * @apiName ListTaxonomyItems
 * @apiGroup TaxonomyItems
 *
 * @apiParam (Query) {String} [type=emailType] the taxonomy to read
 * @apiParam (Query) {Boolean} [activeOnly] only items usable in a select list
 *
 * @apiUse taxonomyItem
 * @apiSuccess {taxonomyItem[]} items
 */
async function listTaxonomyItems(req, res) {
  const items = await taxonomyService.listTaxonomyItems({
    user: req.user,
    type: req.query.type || DEFAULT_TYPE,
    activeOnly: wantsActiveOnly(req),
  });

  res.json({ items });
}

/**
 * @api {get} /taxonomy-items/groups/:groupId list a company's taxonomy items
 * @apiPermission user (own company) or super admin
 * @apiName ListTaxonomyItemsForGroup
 * @apiGroup TaxonomyItems
 *
 * @apiParam {String} groupId
 * @apiParam (Query) {String} [type=emailType]
 * @apiParam (Query) {Boolean} [activeOnly]
 *
 * @apiUse taxonomyItem
 * @apiSuccess {taxonomyItem[]} items
 */
async function listTaxonomyItemsForGroup(req, res) {
  const items = await taxonomyService.listTaxonomyItems({
    user: req.user,
    groupId: req.params.groupId,
    type: req.query.type || DEFAULT_TYPE,
    activeOnly: wantsActiveOnly(req),
  });

  res.json({ items });
}

/**
 * @api {post} /taxonomy-items create a taxonomy item
 * @apiPermission group_admin
 * @apiName CreateTaxonomyItem
 * @apiGroup TaxonomyItems
 *
 * @apiParam (Body) {String} [groupId] super admin only, the target company
 * @apiParam (Body) {String} [type=emailType]
 * @apiParam (Body) {String} label
 * @apiParam (Body) {String} [description] what this typology means for the company
 * @apiParam (Body) {String} [canonicalType] mapping onto the AI skills vocabulary
 * @apiParam (Body) {Boolean} [isActive]
 * @apiParam (Body) {Number} [order]
 *
 * @apiUse taxonomyItem
 */
async function createTaxonomyItem(req, res) {
  const { groupId, type, ...payload } = req.body;

  const item = await taxonomyService.createTaxonomyItem({
    user: req.user,
    groupId,
    type: type || DEFAULT_TYPE,
    payload,
  });

  res.json(item);
}

/**
 * @api {patch} /taxonomy-items/:itemId update a taxonomy item
 * @apiPermission group_admin
 * @apiName UpdateTaxonomyItem
 * @apiGroup TaxonomyItems
 *
 * @apiParam {String} itemId
 *
 * @apiDescription Partial update: a field the payload does not mention is left
 *   untouched. `type` and the owning company are not editable — moving an item
 *   between taxonomies or companies would orphan the emails pointing at it.
 *
 * @apiUse taxonomyItem
 */
async function updateTaxonomyItem(req, res) {
  // `groupId` and `type` are dropped rather than passed on: they are the two
  // fields that must not move once emails point at the item.
  const { groupId: _groupId, type: _type, ...payload } = req.body;

  const item = await taxonomyService.updateTaxonomyItem({
    user: req.user,
    itemId: req.params.itemId,
    payload,
  });

  res.json(item);
}

/**
 * @api {delete} /taxonomy-items/:itemId delete a taxonomy item
 * @apiPermission group_admin
 * @apiName DeleteTaxonomyItem
 * @apiGroup TaxonomyItems
 *
 * @apiParam {String} itemId
 *
 * @apiDescription Refused with a 409 when an email still references the item —
 *   deactivate it instead, so existing emails keep resolving.
 */
async function deleteTaxonomyItem(req, res) {
  await taxonomyService.deleteTaxonomyItem({
    user: req.user,
    itemId: req.params.itemId,
  });

  res.status(204).send();
}
