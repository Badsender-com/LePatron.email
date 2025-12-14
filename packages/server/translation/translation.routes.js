'use strict';

const express = require('express');

const router = express.Router();

const translation = require('./translation.controller.js');

const { GUARD_USER } = require('../account/auth.guard.js');

// Get available languages for the user's group
router.get('/languages', GUARD_USER, translation.getLanguages);

// Translate a single text (for field-by-field translation)
router.post('/text', GUARD_USER, translation.translateText);

// Detect source language of a mailing
router.get(
  '/detect-language/:mailingId',
  GUARD_USER,
  translation.detectLanguage
);

// Get translation job status (for progress polling)
router.get('/jobs/:jobId/status', GUARD_USER, translation.getJobStatus);

// Cancel a translation job
router.post('/jobs/:jobId/cancel', GUARD_USER, translation.cancelJob);

module.exports = router;
