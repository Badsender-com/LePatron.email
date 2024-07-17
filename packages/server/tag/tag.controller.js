'use strict';

const { NotFound, UnprocessableEntity } = require('http-errors');
const asyncHandler = require('express-async-handler');
const modelsUtils = require('../utils/model.js');
const tagService = require('./tag.service.js');
const { Tags } = require('../common/models.common.js');
const ERROR_CODES = require('../constant/error-codes.js');

module.exports = {
  list: asyncHandler(list),
  create: asyncHandler(create),
  read: asyncHandler(read),
  update: asyncHandler(update),
  delete: asyncHandler(deleteTag),
  bulkUpdate: asyncHandler(bulkUpdate),
};

/**
 * @api {get} /tags list of tags
 * @apiPermission user
 * @apiName GetTags
 * @apiGroup Tags
 *
 * @apiUse tags
 * @apiSuccess {tags[]} items list of tags
 */

async function list(req, res) {
  const { user } = req;

  const tags = await tagService.listTags(user);
  res.json(tags);
}

/**
 * @api {post} /tags create tag
 * @apiPermission user
 * @apiName CreateTag
 * @apiGroup Tags
 *
 * @apiParam (Body) {String} label the label of the tag
 * @apiParam (Body) {String} companyId the ID of the company
 *
 * @apiUse tags
 */

async function create(req, res) {
  const { label, companyId } = req.body;
  if (!label || !companyId) {
    throw new UnprocessableEntity(ERROR_CODES.INVALID_TAG_DATA);
  }

  const newTag = await tagService.createTag({ label, companyId });
  res.status(201).json(newTag);
}

/**
 * @api {get} /tags/:tagId tag details
 * @apiPermission user
 * @apiName GetTag
 * @apiGroup Tags
 *
 * @apiParam {string} tagId
 *
 * @apiUse tags
 */

async function read(req, res) {
  const { tagId } = req.params;
  const query = modelsUtils.addGroupFilter(req.user, { _id: tagId });
  const tag = await Tags.findOne(query);
  if (!tag) throw new NotFound(ERROR_CODES.TAG_NOT_FOUND);
  res.json(tag);
}

/**
 * @api {put} /tags/:tagId update tag
 * @apiPermission user
 * @apiName UpdateTag
 * @apiGroup Tags
 *
 * @apiParam {string} tagId
 *
 * @apiParam (Body) {String} label the new label of the tag
 *
 * @apiUse tags
 */

async function update(req, res) {
  const { tagId } = req.params;
  const { label } = req.body;

  if (!label) {
    throw new UnprocessableEntity(ERROR_CODES.INVALID_TAG_DATA);
  }

  const updatedTag = await tagService.updateTag(tagId, { label });
  res.json(updatedTag);
}

/**
 * @api {del} /tags/:tagId delete tag
 * @apiPermission user
 * @apiName DeleteTag
 * @apiGroup Tags
 *
 * @apiParam {string} tagId
 *
 * @apiUse tags
 */

async function deleteTag(req, res) {
  const { tagId } = req.params;
  await tagService.deleteTag(tagId);
  res.status(204).send();
}

/**
 * @api {put} /tags bulk update tags
 * @apiPermission user
 * @apiName BulkUpdateTags
 * @apiGroup Tags
 *
 * @apiParam (Body) {String[]} tagIds the list of tag IDs to update
 * @apiParam (Body) {Object} updates the updates to apply
 * @apiParam (Body) {String[]} updates.labels the new labels for the tags
 *
 * @apiUse tags
 * @apiSuccess {tags[]} items list of updated tags
 */

async function bulkUpdate(req, res) {
  const { tagIds, updates } = req.body;
  if (!Array.isArray(tagIds) || !tagIds.length || !updates) {
    throw new UnprocessableEntity(ERROR_CODES.INVALID_BULK_UPDATE_DATA);
  }

  const updatedTags = await tagService.bulkUpdateTags(tagIds, updates);
  res.json(updatedTags);
}
