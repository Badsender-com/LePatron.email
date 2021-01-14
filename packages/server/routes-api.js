'use strict'

const express = require('express')
const createError = require('http-errors')

const pkg = require('../../package.json')

// we could look to an authorization with JWT
// • https://stackoverflow.com/a/32801226
// • http://www.passportjs.org/docs/other-api/
// • https://scotch.io/tutorials/authenticate-a-node-es6-api-with-json-web-tokens#

const router = express.Router()

const { GUARD_USER, GUARD_ADMIN } = require('./account/auth.guard.js')
const groups = require('./group/group.controller.js')
const mailings = require('./mailing/mainling.controller.js')
const templates = require('./template/template.controller.js')
const users = require('./user/user.controller.js')
const images = require('./image/image.controller.js')

//////
// GROUPS
//////

/* router.all(`/groups*`, GUARD_ADMIN)
router.get(`/groups/:groupId/users`, groups.readUsers)
router.get(`/groups/:groupId/templates`, groups.readTemplates)
router.get(`/groups/:groupId/mailings`, groups.readMailings)
router.put(`/groups/:groupId`, groups.update)
router.get(`/groups/:groupId`, groups.read)
router.post(`/groups`, groups.create)
router.get(`/groups`, groups.list)
 */
//////
// MAILINGS
//////

/* router.post(
  `/mailings/:mailingId/mosaico/send-test-mail`,
  GUARD_USER,
  mailings.sendTestMail,
)
router.post(
  `/mailings/:mailingId/mosaico/download-zip`,
  GUARD_USER,
  mailings.downloadZip,
)
router.put(`/mailings/:mailingId/mosaico`, GUARD_USER, mailings.updateMosaico)
router.get(`/mailings/:mailingId/mosaico`, GUARD_USER, mailings.readMosaico)
router.post(`/mailings/:mailingId/duplicate`, GUARD_USER, mailings.duplicate)
router.post(
  `/mailings/:mailingId/transfer-to-user`,
  GUARD_ADMIN,
  mailings.transferToUser,
)
router.put(`/mailings/:mailingId`, GUARD_USER, mailings.update)
router.get(`/mailings/:mailingId`, GUARD_USER, mailings.read)
router.post(`/mailings`, GUARD_USER, mailings.create)
router.delete(`/mailings`, GUARD_USER, mailings.bulkDestroy)
router.put(`/mailings`, GUARD_USER, mailings.bulkUpdate)
router.get(`/mailings`, GUARD_USER, mailings.list)
 */
//////
// TEMPLATES
//////

/* router.get(`/templates/:templateId/markup`, GUARD_USER, templates.readMarkup)
router.get(
  `/templates/:templateId/preview`,
  GUARD_ADMIN,
  templates.previewMarkup,
)
router.post(
  `/templates/:templateId/preview`,
  GUARD_ADMIN,
  templates.generatePreviews,
)
router.get(
  `/templates/:templateId/events`,
  GUARD_ADMIN,
  templates.previewEvents,
)
router.delete(
  `/templates/:templateId/images`,
  GUARD_ADMIN,
  templates.destroyImages,
)
router.delete(`/templates/:templateId`, GUARD_ADMIN, templates.destroy)
router.put(`/templates/:templateId`, GUARD_ADMIN, templates.update)
router.get(`/templates/:templateId`, GUARD_USER, templates.read)
router.post(`/templates`, GUARD_ADMIN, templates.create)
router.get(`/templates`, GUARD_USER, templates.list)
 */
//////
// ACCOUNT
//////
/* 
router.delete(`/account/:email/password`, users.forgotPassword)
router.put(`/account/:email/password/:token`, users.setPassword)
 */
//////
// USERS
//////
/* 
router.all(`/users*`, GUARD_ADMIN)
router.put(`/users/:userId/activate`, users.activate)
router.put(`/users/:userId/password`, users.setPassword)
router.delete(`/users/:userId/password`, users.adminResetPassword)
router.get(`/users/:userId/mailings`, users.readMailings)
router.delete(`/users/:userId`, users.deactivate)
router.put(`/users/:userId`, users.update)
router.get(`/users/:userId`, users.read)
router.post(`/users`, users.create)
router.get(`/users`, users.list)
 */
//////
// IMAGES
//////
/* 
router.get(
  `/images/placeholder/:placeholderSize`,
  images.checkImageCache,
  images.placeholder,
)
router.get(
  `/images/resize/:sizes/:imageName`,
  images.checkImageCache,
  images.checkSizes,
  images.resize,
)
router.get(
  `/images/cover/:sizes/:imageName`,
  images.checkImageCache,
  images.checkSizes,
  images.cover,
)
router.all(`/images/gallery*`, GUARD_USER)
router.get(`/images/gallery/:mongoId`, images.list)
router.post(`/images/gallery/:mongoId`, images.create)
router.get(`/images/:imageName`, images.read)
router.delete(`/images/:imageName`, GUARD_USER, images.destroy)
 */
//////
// MISCELLANEOUS
//////

/**
 * @api {get} /version version
 * @apiName GetVersion
 * @apiDescription return the application version number
 * @apiGroup Miscellaneous
 *
 * @apiSuccess {String} version
 */
router.get(`/version`, (req, res) => {
  res.json({ version: pkg.version })
})

// catch anything and forward to error handler
router.use((req, res, next) => {
  console.log(req.path)
  next(new createError.NotImplemented())
})

module.exports = router
