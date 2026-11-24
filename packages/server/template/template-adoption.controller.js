'use strict';

const asyncHandler = require('express-async-handler');

const { adoptForTemplate } = require('./template-adoption.service.js');

module.exports = {
  previewAdoption: asyncHandler(previewAdoption),
  applyAdoption: asyncHandler(applyAdoption),
};

const reportOf = ({ emails, counts }) => ({
  emails: emails.map(({ id, name, adopted, gaps }) => ({
    id,
    name,
    adopted,
    gaps,
  })),
  counts,
});

/**
 * @api {get} /templates/:templateId/adoption preview the adoption of its emails
 * @apiPermission taxonomy.manage
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
  res.json(
    reportOf(
      await adoptForTemplate({
        user: req.user,
        templateId: req.params.templateId,
        apply: false,
      })
    )
  );
}

/**
 * @api {post} /templates/:templateId/adoption apply the adoption of its emails
 * @apiPermission taxonomy.manage
 * @apiName ApplyTemplateAdoption
 * @apiGroup Templates
 * @apiDescription Writes the taxonomy values of the empty dimensions only,
 *   never an email's content. Run again, it changes nothing.
 *
 * @apiParam {String} templateId
 *
 * @apiSuccess {Object[]} emails what each email was given, and its gaps
 * @apiSuccess {Object} counts `attached`, `withGaps` and `complete`
 */
async function applyAdoption(req, res) {
  res.json(
    reportOf(
      await adoptForTemplate({
        user: req.user,
        templateId: req.params.templateId,
        apply: true,
      })
    )
  );
}
