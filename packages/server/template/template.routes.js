'use strict';

const express = require('express');
const createError = require('http-errors');

const router = express.Router();

const {
  GUARD_USER,
  GUARD_ADMIN,
  GUARD_GROUP_ADMIN,
  GUARD_GROUP_ADMIN_TECH,
  GUARD_CAN,
} = require('../account/auth.guard.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');
const { GUARD_EMAIL_BUILDER } = require('../mailing/email-builder.guard.js');
const ERROR_CODES = require('../constant/error-codes.js');
const { isObjectIdString } = require('../utils/model.js');
const templates = require('./template.controller.js');
const adoption = require('./template-adoption.controller.js');

// Every `:templateId` is an ObjectId: anything else is a bad request, refused
// here before any controller reads it.
router.param('templateId', (req, res, next, templateId) => {
  if (!isObjectIdString(templateId)) {
    return next(new createError.BadRequest(ERROR_CODES.INVALID_OBJECT_ID));
  }
  return next();
});

/// ///
// TEMPLATES
/// ///

// All routes below require an authenticated user AND the Email Builder module
// to be enabled on the user's group (super admins bypass the flag check).
router.use(GUARD_USER, GUARD_EMAIL_BUILDER);

router.get('/:templateId/markup', GUARD_USER, templates.readMarkup);
// Block introspection: used by the content-feed mapping config UI to let a
// company_admin_tech pick a block + its field paths without hand-typing
// Mosaico internal property names.
// Every block + its field paths in a single payload: the mapping UI parses the
// (expensive-to-parse) markup once per template rather than once per block.
router.get(
  '/:templateId/blocks-with-fields',
  GUARD_GROUP_ADMIN_TECH,
  templates.listBlocksWithFields
);
router.get('/:templateId/preview', GUARD_ADMIN, templates.previewMarkup);
router.post('/:templateId/preview', GUARD_ADMIN, templates.generatePreviews);
router.get('/:templateId/events', GUARD_ADMIN, templates.previewEvents);
// The adoption of the template's emails in bulk (ADR-0024), by whoever builds
// the taxonomy (ADR-0026); the service keeps it to the user's own company.
router.get(
  '/:templateId/adoption',
  GUARD_CAN(CAPABILITIES.TAXONOMY_MANAGE),
  adoption.previewAdoption
);
router.post(
  '/:templateId/adoption',
  GUARD_CAN(CAPABILITIES.TAXONOMY_MANAGE),
  adoption.applyAdoption
);
router.delete('/:templateId/images', GUARD_ADMIN, templates.destroyImages);
router.delete('/:templateId', GUARD_ADMIN, templates.destroy);
// Tracking config is editable by company_admin_tech of the template's company
// (not only super admins as for the rest of the template edition flow).
// The controller enforces that constraint by checking req.user against
// template._company.
router.put(
  '/:templateId/tracking-config',
  GUARD_GROUP_ADMIN_TECH,
  templates.updateTrackingConfig
);
// A company admin may override the quality settings of their own company's
// templates (checked in the controller).
router.put(
  '/:templateId/quality-settings',
  GUARD_GROUP_ADMIN,
  templates.updateQualitySettings
);
router.put('/:templateId', GUARD_ADMIN, templates.update);
// One template with its settings: only the super admin's template page reads it.
router.get('/:templateId', GUARD_ADMIN, templates.read);
router.post('', GUARD_ADMIN, templates.create);
router.get('', GUARD_USER, templates.list);

// catch anything and forward to error handler
router.use((req, res, next) => {
  console.log(req.path);
  next(new createError.NotImplemented());
});

module.exports = router;
