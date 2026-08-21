'use strict';

const express = require('express');
const createError = require('http-errors');

const router = express.Router();

const { GUARD_USER, GUARD_GROUP_ADMIN } = require('../account/auth.guard.js');
const { GUARD_CAN_ACCESS_GROUP } = require('../group/group.guard.js');
const taxonomy = require('./taxonomy.controller.js');

// Reads are GUARD_USER: any user filling in an email's metadata needs the list of
// typologies, not just company admins — who own create/update/delete.
router.get('', GUARD_USER, taxonomy.listTaxonomyItems);

// Must come before '/:itemId' below, otherwise "groups" is captured as an itemId.
router.get(
  '/groups/:groupId',
  GUARD_USER,
  GUARD_CAN_ACCESS_GROUP,
  taxonomy.listTaxonomyItemsForGroup
);

router.post('', GUARD_GROUP_ADMIN, taxonomy.createTaxonomyItem);
router.patch('/:itemId', GUARD_GROUP_ADMIN, taxonomy.updateTaxonomyItem);
router.delete('/:itemId', GUARD_GROUP_ADMIN, taxonomy.deleteTaxonomyItem);

// catch anything and forward to error handler
router.use((req, res, next) => {
  next(new createError.NotImplemented());
});

module.exports = router;
