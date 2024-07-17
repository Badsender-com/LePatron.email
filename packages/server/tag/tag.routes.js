'use strict';

const express = require('express');
const createError = require('http-errors');

const router = express.Router();

const { GUARD_USER } = require('../account/auth.guard.js');
const tags = require('./tag.controller.js');

/// ///
// TAGS
/// ///

router.get('', GUARD_USER, tags.list);
router.post('', GUARD_USER, tags.create);
router.get('/:tagId', GUARD_USER, tags.read);
router.put('/:tagId', GUARD_USER, tags.update);
router.delete('/:tagId', GUARD_USER, tags.delete);
router.put('/bulk-update', GUARD_USER, tags.bulkUpdate);

// catch anything and forward to error handler
router.use((req, res, next) => {
  console.log(req.path);
  next(new createError.NotImplemented());
});

module.exports = router;
