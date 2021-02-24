'use strict';

const express = require('express');
const createError = require('http-errors');

const pkg = require('../../../package.json');

const router = express.Router();

/// ///
// MISCELLANEOUS
/// ///

/**
 * @api {get} /version version
 * @apiName GetVersion
 * @apiDescription return the application version number
 * @apiGroup Miscellaneous
 *
 * @apiSuccess {String} version
 */
router.get('', (req, res) => {
  res.json({ version: pkg.version });
});

// catch anything and forward to error handler
router.use((req, res, next) => {
  console.log(req.path);
  next(new createError.NotImplemented());
});

module.exports = router;
