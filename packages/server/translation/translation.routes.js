'use strict';

const express = require('express');

const router = express.Router();

const translation = require('./translation.controller.js');

const { GUARD_USER, GUARD_CAN } = require('../account/auth.guard.js');
const { CAPABILITIES: C } = require('../../shared/access/roles.js');

// Get available languages for the user's group
router.get('/languages', GUARD_USER, translation.getLanguages);

// Translate a single text (for field-by-field translation)
router.post(
  '/text',
  GUARD_CAN(C.MAILING_EDIT_CONTENT),
  translation.translateText
);

// Translate a single block (for block-level translation in editor)
router.post(
  '/block',
  GUARD_CAN(C.MAILING_EDIT_CONTENT),
  translation.translateBlock
);

// Get translation job status (for progress polling)
router.get('/jobs/:jobId/status', GUARD_USER, translation.getJobStatus);

// Cancel a translation job
router.post(
  '/jobs/:jobId/cancel',
  GUARD_CAN(C.MAILING_EDIT_CONTENT),
  translation.cancelJob
);

module.exports = router;
