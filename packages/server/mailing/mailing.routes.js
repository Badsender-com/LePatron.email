'use strict';

const express = require('express');
const createError = require('http-errors');

const router = express.Router();

const { GUARD_USER, GUARD_ADMIN } = require('../account/auth.guard.js');
const mailings = require('./mailing.controller.js');

router.get('', GUARD_USER, mailings.list);
router.post('', GUARD_USER, mailings.create);
router.patch('/:mailingId', GUARD_USER, mailings.rename);
router.get('/:mailingId/preview', GUARD_USER, mailings.previewHtml);
router.get('/:mailingId/esp-ids', GUARD_USER, mailings.readMailingEpsIds);
router.delete('/:mailingId', GUARD_USER, mailings.delete);
router.post('/copy', GUARD_USER, mailings.copy);
router.post('/:mailingId/move', GUARD_USER, mailings.move);
router.post('/move-many', GUARD_USER, mailings.moveMany);
router.post(
  '/:mailingId/mosaico/send-test-mail',
  GUARD_USER,
  mailings.sendTestMail
);
router.post(
  '/:mailingId/mosaico/download-zip',
  GUARD_USER,
  mailings.downloadZip
);

router.post('/download-multiple-zip', GUARD_USER, mailings.downloadMultipleZip);

router.put('/:mailingId/mosaico', GUARD_USER, mailings.updateMosaico);
router.get('/:mailingId/mosaico', GUARD_USER, mailings.readMosaico);
router.post('/:mailingId/duplicate', GUARD_USER, mailings.duplicate);
router.post(
  '/:mailingId/transfer-to-user',
  GUARD_ADMIN,
  mailings.transferToUser
);
router.get('/:mailingId', GUARD_USER, mailings.read);
router.put('', GUARD_USER, mailings.bulkUpdate);

// catch anything and forward to error handler
router.use((req, res, next) => {
  console.log(req.path);
  next(new createError.NotImplemented());
});

module.exports = router;
