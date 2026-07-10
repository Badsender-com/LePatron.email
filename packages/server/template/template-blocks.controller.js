'use strict';

const createError = require('http-errors');
const asyncHandler = require('express-async-handler');

const { Templates } = require('../common/models.common.js');
const modelsUtils = require('../utils/model.js');
const {
  listBlockNames,
  getBlockFieldPaths,
} = require('./template-block-parser.js');

module.exports = {
  listBlocks: asyncHandler(listBlocks),
  listBlockFields: asyncHandler(listBlockFields),
};

/**
 * @api {get} /templates/:templateId/blocks list block names found in a template's markup
 * @apiPermission groupAdmin
 * @apiName ListTemplateBlocks
 * @apiGroup Templates
 *
 * @apiParam {String} templateId
 * @apiSuccess {String[]} items Block names (e.g. "articlesBlock")
 */
async function listBlocks(req, res) {
  const template = await findTemplateForUser(req);
  res.json({ items: listBlockNames(template.markup) });
}

/**
 * @api {get} /templates/:templateId/blocks/:blockName/fields list field paths for a block
 * @apiPermission groupAdmin
 * @apiName ListTemplateBlockFields
 * @apiGroup Templates
 *
 * @apiParam {String} templateId
 * @apiParam {String} blockName
 * @apiSuccess {String[]} items Block property paths (e.g. "imageOptions.src")
 */
async function listBlockFields(req, res) {
  const { blockName } = req.params;
  const template = await findTemplateForUser(req);
  res.json({ items: getBlockFieldPaths(template.markup, blockName) });
}

async function findTemplateForUser(req) {
  const { templateId } = req.params;
  const templateQuery = modelsUtils.addGroupFilter(req.user, {
    _id: templateId,
  });
  const template = await Templates.findOne(templateQuery);
  if (!template) throw new createError.NotFound();
  return template;
}
