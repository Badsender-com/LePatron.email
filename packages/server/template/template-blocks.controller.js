'use strict';

const createError = require('http-errors');
const asyncHandler = require('express-async-handler');

const { Templates } = require('../common/models.common.js');
const modelsUtils = require('../utils/model.js');
const { parseTemplateBlocks } = require('./template-block-parser.js');

module.exports = {
  listBlocksWithFields: asyncHandler(listBlocksWithFields),
};

/**
 * @api {get} /templates/:templateId/blocks-with-fields list every block and its field paths
 * @apiPermission groupAdmin
 * @apiName ListTemplateBlocksWithFields
 * @apiGroup Templates
 *
 * @apiDescription Parses the template markup once and returns every block name
 * together with its field paths, so the feed-mapping UI can populate the whole
 * block/field picker with a single request instead of one call per block. The
 * template markup is expensive to parse (cheerio), so collapsing N+1 requests
 * into one materially reduces CPU load on small instances.
 *
 * @apiParam {String} templateId
 * @apiSuccess {String[]} blocks Block names (e.g. "articlesBlock")
 * @apiSuccess {Object} fieldsByBlock Map of block name to its field paths
 */
async function listBlocksWithFields(req, res) {
  const template = await findTemplateForUser(req);
  const { blockNames, fieldsByBlock } = parseTemplateBlocks(template.markup);
  res.json({ blocks: blockNames, fieldsByBlock });
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
