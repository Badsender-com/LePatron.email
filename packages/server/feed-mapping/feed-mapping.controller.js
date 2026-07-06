'use strict';

const asyncHandler = require('express-async-handler');
const pick = require('lodash').pick;

const feedMappingService = require('./feed-mapping.service.js');
const groupService = require('../group/group.service.js');

const CREATE_FIELDS = [
  'integrationId',
  'templateId',
  'blockName',
  'fieldMapping',
  'ctaDefaultLabel',
];
const UPDATE_FIELDS = [...CREATE_FIELDS, 'isActive'];

module.exports = {
  createFeedMapping: asyncHandler(createFeedMapping),
  updateFeedMapping: asyncHandler(updateFeedMapping),
  deleteFeedMapping: asyncHandler(deleteFeedMapping),
  listFeedMappingsForGroup: asyncHandler(listFeedMappingsForGroup),
  listFeedMappingsForTemplate: asyncHandler(listFeedMappingsForTemplate),
};

/**
 * @api {post} /feed-mappings Create a feed mapping
 * @apiPermission groupAdmin
 * @apiName CreateFeedMapping
 * @apiGroup FeedMappings
 *
 * @apiParam (Body) {String} integrationId Feed source integration ID
 * @apiParam (Body) {String} templateId Template ID
 * @apiParam (Body) {String} blockName Block name (e.g. "articlesBlock")
 * @apiParam (Body) {Object[]} fieldMapping One entry per column (1-4): { [blockFieldPath]: feedPropertyName }
 * @apiParam (Body) {String} [ctaDefaultLabel]
 */
async function createFeedMapping(req, res) {
  const { user, body } = req;

  const feedMapping = await feedMappingService.create({
    user,
    ...pick(body, CREATE_FIELDS),
  });

  res.status(201).json(feedMapping);
}

/**
 * @api {put} /feed-mappings/:feedMappingId Update a feed mapping
 * @apiPermission groupAdmin
 * @apiName UpdateFeedMapping
 * @apiGroup FeedMappings
 */
async function updateFeedMapping(req, res) {
  const { user, params, body } = req;
  const { feedMappingId } = params;

  const feedMapping = await feedMappingService.update({
    user,
    feedMappingId,
    fields: pick(body, UPDATE_FIELDS),
  });

  res.json(feedMapping);
}

/**
 * @api {delete} /feed-mappings/:feedMappingId Delete a feed mapping
 * @apiPermission groupAdmin
 * @apiName DeleteFeedMapping
 * @apiGroup FeedMappings
 */
async function deleteFeedMapping(req, res) {
  const { user, params } = req;
  const { feedMappingId } = params;

  await feedMappingService.deleteFeedMapping({ user, feedMappingId });

  res.json({ success: true });
}

/**
 * @api {get} /feed-mappings/groups/:groupId List feed mappings for a group
 * @apiPermission groupAdmin
 * @apiName ListFeedMappingsForGroup
 * @apiGroup FeedMappings
 */
async function listFeedMappingsForGroup(req, res) {
  const { user, params } = req;
  const { groupId } = params;

  await groupService.checkIfUserIsAuthorizedToAccessGroup({ user, groupId });

  const items = await feedMappingService.findAllByGroup({ groupId });
  res.json({ items });
}

/**
 * @api {get} /feed-mappings List active feed mappings for a template
 * @apiPermission user
 * @apiName ListFeedMappingsForTemplate
 * @apiGroup FeedMappings
 *
 * @apiQuery {String} templateId
 */
async function listFeedMappingsForTemplate(req, res) {
  const { user, query } = req;
  const { templateId } = query;

  const items = await feedMappingService.findActiveByTemplate({
    templateId,
    user,
  });

  res.json({ items });
}
