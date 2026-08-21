'use strict';

const express = require('express');
const createError = require('http-errors');

const router = express.Router();

const { GUARD_USER, GUARD_GROUP_ADMIN } = require('../account/auth.guard.js');
const {
  GUARD_CAN_ACCESS_GROUP,
  GUARD_CAN_ACCESS_GROUP_FROM_BODY,
} = require('../group/group.guard.js');
const { GUARD_EMAIL_METADATA } = require('../mailing/email-metadata.guard.js');
const taxonomy = require('./taxonomy.controller.js');

// GUARD_EMAIL_METADATA on every route, reads included: a taxonomy only exists to
// serve the email metadata, so while a company has not opted in the feature stays
// closed through the API too, not only in the interface. Super admins bypass it,
// as everywhere else.
//
// Note what this flag is and is not. It is a self-service switch: a company admin
// may raise it on their own company through PUT /groups/:groupId, and then use
// everything below. It is not a commercial lock — turning it into one means moving
// `emailMetadata` out of the company-admin whitelist in group.controller.js.
//
// Reads are GUARD_USER: any user filling in an email's metadata needs the list of
// typologies, not just company admins — who own create/update/delete.
router.get('', GUARD_USER, GUARD_EMAIL_METADATA, taxonomy.listTaxonomyItems);

// Must come before '/:itemId' below, otherwise "groups" is captured as an itemId.
router.get(
  '/groups/:groupId',
  GUARD_USER,
  GUARD_CAN_ACCESS_GROUP,
  GUARD_EMAIL_METADATA,
  taxonomy.listTaxonomyItemsForGroup
);

// The service resolves the company itself and never trusts `groupId`, but the
// guard states the boundary where the rest of the codebase states it too.
router.post(
  '',
  GUARD_GROUP_ADMIN,
  GUARD_CAN_ACCESS_GROUP_FROM_BODY,
  GUARD_EMAIL_METADATA,
  taxonomy.createTaxonomyItem
);
router.patch(
  '/:itemId',
  GUARD_GROUP_ADMIN,
  GUARD_EMAIL_METADATA,
  taxonomy.updateTaxonomyItem
);
router.delete(
  '/:itemId',
  GUARD_GROUP_ADMIN,
  GUARD_EMAIL_METADATA,
  taxonomy.deleteTaxonomyItem
);

// catch anything and forward to error handler
router.use((req, res, next) => {
  next(new createError.NotImplemented());
});

module.exports = router;
