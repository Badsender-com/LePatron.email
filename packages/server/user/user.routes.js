'use strict';

const express = require('express');
const createError = require('http-errors');
const router = express.Router();

const { GUARD_ADMIN } = require('../account/auth.guard.js');
const users = require('./user.controller.js');

//////
// USERS
//////

router.all(`*`, GUARD_ADMIN);
router.put(`/:userId/activate`, users.activate);
router.put(`/:userId/password`, users.setPassword);
router.delete(`/:userId/password`, users.adminResetPassword);
router.get(`/:userId/mailings`, users.readMailings);
router.delete(`/:userId`, users.deactivate);
router.put(`/:userId`, users.update);
router.get(`/:userId`, users.read);
router.post(``, users.create);
router.get(``, users.list);

// catch anything and forward to error handler
router.use((req, res, next) => {
  console.log(req.path);
  next(new createError.NotImplemented());
});

module.exports = router;
