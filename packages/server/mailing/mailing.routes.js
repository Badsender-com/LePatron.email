'use strict'

const express = require('express')
const createError = require('http-errors')

const router = express.Router()

const { GUARD_USER, GUARD_ADMIN } = require('../account/auth.guard.js')
const mailings = require('./mainling.controller.js')

router.post(
  `/:mailingId/mosaico/send-test-mail`,
  GUARD_USER,
  mailings.sendTestMail,
)
router.post(
  `/:mailingId/mosaico/download-zip`,
  GUARD_USER,
  mailings.downloadZip,
)
router.put(`/:mailingId/mosaico`, GUARD_USER, mailings.updateMosaico)
router.get(`/:mailingId/mosaico`, GUARD_USER, mailings.readMosaico)
router.post(`/:mailingId/duplicate`, GUARD_USER, mailings.duplicate)
router.post(
  `/:mailingId/transfer-to-user`,
  GUARD_ADMIN,
  mailings.transferToUser,
)
router.put(`/:mailingId`, GUARD_USER, mailings.update)
router.get(`/:mailingId`, GUARD_USER, mailings.read)
router.post(``, GUARD_USER, mailings.create)
router.delete(``, GUARD_USER, mailings.bulkDestroy)
router.put(``, GUARD_USER, mailings.bulkUpdate)
router.get(``, GUARD_USER, mailings.list)

// catch anything and forward to error handler
router.use((req, res, next) => {
  console.log(req.path)
  next(new createError.NotImplemented())
})

module.exports = router
