'use strict';

const express = require('express');
const createError = require('http-errors');

const router = express.Router();

const {
  GUARD_USER,
  GUARD_ADMIN,
  GUARD_CAN,
} = require('../account/auth.guard.js');
const { CAPABILITIES: C } = require('../../shared/access/roles.js');
const { GUARD_EMAIL_BUILDER } = require('./email-builder.guard.js');
const { GUARD_EMAIL_METADATA } = require('./email-metadata.guard.js');
const mailings = require('./mailing.controller.js');
const { requireJsonBody } = require('../utils/require-json-body.js');
const mailingMetadata = require('./mailing-metadata.controller.js');
const translation = require('../translation/translation.controller.js');

// All routes below require an authenticated user AND the Email Builder module
// to be enabled on the user's group (super admins bypass the flag check).
router.use(GUARD_USER, GUARD_EMAIL_BUILDER);

router.get('', GUARD_USER, mailings.list);
// Searching every accessible workspace is a read: no capability (ADR 0007).
// Declared before the '/:mailingId' routes, like '/tags' below.
router.get('/search', GUARD_USER, mailings.search);
// Must be declared before the '/:mailingId' routes below, otherwise "tags"
// would be captured as a mailingId.
router.get('/tags', GUARD_USER, mailings.listTags);
router.post('', GUARD_CAN(C.MAILING_CREATE), mailings.create);
router.patch('/:mailingId', GUARD_CAN(C.MAILING_ORGANIZE), mailings.rename);
router.get('/:mailingId/preview', GUARD_USER, mailings.previewHtml);
router.get('/:mailingId/esp-ids', GUARD_USER, mailings.readMailingEpsIds);
router.delete('/:mailingId', GUARD_CAN(C.MAILING_DELETE), mailings.delete);
router.post('/copy', GUARD_CAN(C.MAILING_ORGANIZE), mailings.copy);
router.post('/:mailingId/move', GUARD_CAN(C.MAILING_ORGANIZE), mailings.move);
router.post('/move-many', GUARD_CAN(C.MAILING_ORGANIZE), mailings.moveMany);
router.post(
  '/:mailingId/mosaico/send-test-mail',
  GUARD_CAN(C.MAILING_SEND_TEST),
  requireJsonBody,
  mailings.sendTestMail
);
router.post(
  '/:mailingId/mosaico/download-zip',
  GUARD_CAN(C.MAILING_EXPORT),
  requireJsonBody,
  mailings.downloadZip
);

router.post(
  '/download-multiple-zip',
  GUARD_CAN(C.MAILING_EXPORT),
  requireJsonBody,
  mailings.downloadMultipleZip
);

router.patch(
  '/:mailingId/metadata',
  GUARD_CAN(C.MAILING_EDIT_CONTENT),
  GUARD_EMAIL_METADATA,
  mailingMetadata.updateMetadata
);
router.put(
  '/:mailingId/mosaico',
  GUARD_CAN(C.MAILING_EDIT_CONTENT),
  mailings.updateMosaico
);
router.get('/:mailingId/mosaico', GUARD_USER, mailings.readMosaico);
router.post(
  '/:mailingId/duplicate',
  GUARD_CAN(C.MAILING_ORGANIZE),
  mailings.duplicate
);
router.post(
  '/:mailingId/duplicate-translate',
  GUARD_CAN(C.MAILING_ORGANIZE),
  translation.duplicateAndTranslate
);
router.post(
  '/:mailingId/transfer-to-user',
  GUARD_ADMIN,
  mailings.transferToUser
);
router.get('/:mailingId', GUARD_USER, mailings.read);
router.put('', GUARD_CAN(C.MAILING_ORGANIZE), mailings.bulkUpdate);

// catch anything and forward to error handler
router.use((req, res, next) => {
  console.log(req.path);
  next(new createError.NotImplemented());
});

module.exports = router;
