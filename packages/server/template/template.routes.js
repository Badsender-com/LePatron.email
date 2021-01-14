'use strict'

const express = require('express')
const createError = require('http-errors')

const router = express.Router()

const { GUARD_USER, GUARD_ADMIN } = require('../account/auth.guard.js')
const templates = require('./template.controller.js')

//////
// TEMPLATES
//////

router.get(`/:templateId/markup`, GUARD_USER, templates.readMarkup)
router.get(`/:templateId/preview`, GUARD_ADMIN, templates.previewMarkup)
router.post(`/:templateId/preview`, GUARD_ADMIN, templates.generatePreviews)
router.get(`/:templateId/events`, GUARD_ADMIN, templates.previewEvents)
router.delete(`/:templateId/images`, GUARD_ADMIN, templates.destroyImages)
router.delete(`/:templateId`, GUARD_ADMIN, templates.destroy)
router.put(`/:templateId`, GUARD_ADMIN, templates.update)
router.get(`/:templateId`, GUARD_USER, templates.read)
router.post(``, GUARD_ADMIN, templates.create)
router.get(``, GUARD_USER, templates.list)

// catch anything and forward to error handler
router.use((req, res, next) => {
  console.log(req.path)
  next(new createError.NotImplemented())
})

module.exports = router
