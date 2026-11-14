'use strict';

const asyncHandler = require('express-async-handler');

const { adoptForTemplate } = require('./template-adoption.service.js');

module.exports = {
  previewAdoption: asyncHandler(previewAdoption),
};

/**
 * @api {get} /templates/:templateId/adoption preview the adoption of its emails
 * @apiPermission super_admin
 * @apiName PreviewTemplateAdoption
 * @apiGroup Templates
 *
 * @apiParam {String} templateId
 *
 * @apiSuccess {Object[]} emails per email of the template, its `id`, `name`,
 *   the identifiers adoption would set (`adopted`) and its `gaps`
 * @apiSuccess {Object} counts `attached`, `withGaps` and `complete`
 */
async function previewAdoption(req, res) {
  const { emails, counts } = await adoptForTemplate({
    templateId: req.params.templateId,
    apply: false,
  });
  res.json({
    emails: emails.map(({ id, name, adopted, gaps }) => ({
      id,
      name,
      adopted,
      gaps,
    })),
    counts,
  });
}
