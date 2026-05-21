'use strict';

const express = require('express');
const createError = require('http-errors');

const router = express.Router();

const {
  GUARD_USER,
  GUARD_ADMIN,
  GUARD_GROUP_ADMIN,
} = require('../account/auth.guard.js');
const templates = require('./template.controller.js');

/// ///
// TEMPLATES
/// ///

router.get('/:templateId/markup', GUARD_USER, templates.readMarkup);
router.get('/:templateId/preview', GUARD_ADMIN, templates.previewMarkup);
router.post('/:templateId/preview', GUARD_ADMIN, templates.generatePreviews);
router.get('/:templateId/events', GUARD_ADMIN, templates.previewEvents);
router.delete('/:templateId/images', GUARD_ADMIN, templates.destroyImages);
router.delete('/:templateId', GUARD_ADMIN, templates.destroy);
// Tracking config is editable by group admins of the template's company
// (not only super admins as for the rest of the template edition flow).
// The controller enforces that constraint by checking req.user against
// template._company.
router.put(
  '/:templateId/tracking-config',
  GUARD_GROUP_ADMIN,
  templates.updateTrackingConfig
);
router.put('/:templateId', GUARD_ADMIN, templates.update);
router.get('/:templateId', GUARD_USER, templates.read);
router.post('', GUARD_ADMIN, templates.create);
router.get('', GUARD_USER, templates.list);

// catch anything and forward to error handler
router.use((req, res, next) => {
  console.log(req.path);
  next(new createError.NotImplemented());
});

module.exports = router;
