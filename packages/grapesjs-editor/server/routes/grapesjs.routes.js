'use strict';

const express = require('express');
const router = express.Router();
const blocksController = require('../controllers/blocks.controller');
const templatesController = require('../controllers/templates.controller');

console.log('✅ GrapesJS routes loaded, templatesController:', {
  loadTemplate: typeof templatesController.loadTemplate,
  saveTemplate: typeof templatesController.saveTemplate,
});

/**
 * @api {get} /api/grapesjs/blocks/standard Get standard blocks
 * @apiName GetStandardBlocks
 * @apiGroup GrapesJS
 * @apiDescription Retrieve the list of standard blocks available for all users
 *
 * @apiSuccess {Object[]} blocks List of standard blocks
 * @apiSuccess {String} blocks.id Block identifier
 * @apiSuccess {String} blocks.label Block label
 * @apiSuccess {String} blocks.category Block category
 * @apiSuccess {Object} blocks.content Block HTML content
 */
router.get('/blocks/standard', blocksController.getStandardBlocks);

/**
 * @api {get} /api/grapesjs/blocks/custom/:templateId Get custom blocks
 * @apiName GetCustomBlocks
 * @apiGroup GrapesJS
 * @apiDescription Retrieve custom blocks for a specific template
 *
 * @apiParam {String} templateId Template ID
 * @apiSuccess {Object[]} blocks List of custom blocks
 */
router.get('/blocks/custom/:templateId', blocksController.getCustomBlocks);

/**
 * @api {post} /api/grapesjs/templates/:id/save Save template
 * @apiName SaveTemplate
 * @apiGroup GrapesJS
 * @apiDescription Save GrapesJS template data
 *
 * @apiParam {String} id Template ID
 * @apiParam {Object} grapesjs_data GrapesJS data (components, styles, assets)
 * @apiSuccess {Boolean} success Operation status
 */
router.post('/templates/:id/save', templatesController.saveTemplate);

/**
 * @api {get} /api/grapesjs/templates/:id Load template
 * @apiName LoadTemplate
 * @apiGroup GrapesJS
 * @apiDescription Load GrapesJS template data
 *
 * @apiParam {String} id Template ID
 * @apiSuccess {Object} grapesjs_data GrapesJS data
 */
router.get('/templates/:id', templatesController.loadTemplate);

/**
 * @api {post} /api/grapesjs/templates/:id/export Export template to HTML
 * @apiName ExportTemplate
 * @apiGroup GrapesJS
 * @apiDescription Export template as email-compatible HTML
 *
 * @apiParam {String} id Template ID
 * @apiSuccess {String} html Exported HTML
 */
router.post('/templates/:id/export', templatesController.exportTemplate);

/**
 * @api {post} /api/grapesjs/templates/:id/preview Preview template
 * @apiName PreviewTemplate
 * @apiGroup GrapesJS
 * @apiDescription Generate preview HTML with variables substituted
 *
 * @apiParam {String} id Template ID
 * @apiSuccess {String} html Preview HTML
 */
router.post('/templates/:id/preview', templatesController.previewTemplate);

module.exports = router;
