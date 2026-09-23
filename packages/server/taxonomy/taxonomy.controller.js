'use strict';

const asyncHandler = require('express-async-handler');
const { omit } = require('lodash');

const taxonomyService = require('./taxonomy.service.js');
const { TaxonomyTypes } = require('../constant/taxonomy-type.js');

module.exports = {
  listTaxonomyItems: asyncHandler(listTaxonomyItems),
  listTaxonomyItemsForGroup: asyncHandler(listTaxonomyItemsForGroup),
  createTaxonomyItem: asyncHandler(createTaxonomyItem),
  updateTaxonomyItem: asyncHandler(updateTaxonomyItem),
  deleteTaxonomyItem: asyncHandler(deleteTaxonomyItem),
  previewDefaultEmailTypes: asyncHandler(previewDefaultEmailTypes),
  restoreDefaultEmailTypes: asyncHandler(restoreDefaultEmailTypes),
};

// Phase 1 has a single taxonomy, so a caller that does not name one gets it.
// Kept explicit rather than hidden in the service: when `language` or `brand`
// arrive, an unnamed type must stop meaning "email type".
const DEFAULT_TYPE = TaxonomyTypes.EMAIL_TYPE;

// A query-string boolean arrives as a string; `?activeOnly=1` meaning the opposite
// of what it says would be a trap.
const TRUTHY_QUERY_VALUES = new Set(['true', '1', 'yes']);
const wantsActiveOnly = (req) =>
  TRUTHY_QUERY_VALUES.has(String(req.query.activeOnly).toLowerCase());

// The language of the labels to create. Taken from the caller's own account
// rather than a query parameter: a TaxonomyItem stores one label, and the person
// clicking the button is reading the screen in that language — offering them a
// list in the other one would be a choice nobody asked to make.
const seedLangOf = (req) => (req.user && req.user.lang) || undefined;

/**
 * @api {get} /taxonomy-items/default-email-types what restoring the defaults would create
 * @apiPermission group_admin
 * @apiName PreviewDefaultEmailTypes
 * @apiGroup TaxonomyItems
 *
 * @apiParam (Query) {String} [groupId] super admin only, the target company
 *
 * @apiSuccess {Object[]} toCreate the default types the company does not have
 * @apiSuccess {Object[]} skipped types whose label is already taken by another item
 *
 * @apiDescription Writes nothing. Feeds the confirmation dialog, so that it names
 *   the typologies it is about to create rather than announcing a count.
 */
async function previewDefaultEmailTypes(req, res) {
  const plan = await taxonomyService.previewMissingDefaultEmailTypes({
    user: req.user,
    groupId: req.query.groupId,
    lang: seedLangOf(req),
  });

  res.json(plan);
}

/**
 * @api {post} /taxonomy-items/default-email-types create the missing default types
 * @apiPermission group_admin
 * @apiName RestoreDefaultEmailTypes
 * @apiGroup TaxonomyItems
 *
 * @apiParam (Body) {String} [groupId] super admin only, the target company
 *
 * @apiSuccess {taxonomyItem[]} created
 * @apiSuccess {Object[]} skipped types whose label is already taken by another item
 *
 * @apiDescription Additive and idempotent: a type the company already maps is left
 *   alone, so clicking twice creates nothing the second time. The body carries no
 *   list of items — what to create is recomputed server-side, never taken from the
 *   caller.
 */
async function restoreDefaultEmailTypes(req, res) {
  const result = await taxonomyService.addMissingDefaultEmailTypes({
    user: req.user,
    groupId: req.body.groupId,
    lang: seedLangOf(req),
  });

  res.json(result);
}

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
  const payload = omit(req.body, ['groupId', 'type']);

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
