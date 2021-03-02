'use strict';

const express = require('express');
const createError = require('http-errors');

const router = express.Router();

const {
  GUARD_ADMIN,
  GUARD_ADMIN_OR_GROUP_ADMIN,
} = require('../account/auth.guard.js');
const groups = require('./group.controller.js');

router.all('*', GUARD_ADMIN);
router.get('/:groupId/users', groups.readUsers);
router.get('/:groupId/templates', groups.readTemplates);
router.get('/:groupId/mailings', groups.readMailings);
router.put('/:groupId', GUARD_ADMIN_OR_GROUP_ADMIN, groups.update);
router.get('/:groupId', GUARD_ADMIN_OR_GROUP_ADMIN, groups.read);
router.post('', groups.create);
router.get('', groups.list);

// catch anything and forward to error handler
router.use((req, res, next) => {
  console.log(req.path);
  next(new createError.NotImplemented());
});

module.exports = router;
