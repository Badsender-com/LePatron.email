'use strict';

const express = require('express');
const createError = require('http-errors');

const router = express.Router();

const { GUARD_USER, GUARD_GROUP_ADMIN } = require('../account/auth.guard.js');
const {
  GUARD_CAN_ACCESS_GROUP,
  GUARD_CAN_ACCESS_GROUP_FROM_BODY,
} = require('../group/group.guard.js');
const taxonomy = require('./taxonomy.controller.js');

// Deliberately NOT gated by `emailMetadata.enabled`. A taxonomy is a
// cross-cutting concern — the coming CRM Governance module will read it too — and,
// more immediately, an admin must be able to prepare a company's typologies BEFORE
// switching the metadata on. Gating the taxonomy behind the flag forced the
// opposite order, and users would have met metadata fields whose typology picker
// had nothing in it.
//
// The flag gates the metadata themselves, and only those: PATCH
// /mailings/:id/metadata, the creation payload, and the listing.
//
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

// The service resolves the company itself and never trusts `groupId`, but the
// guard states the boundary where the rest of the codebase states it too.
router.post(
  '',
  GUARD_GROUP_ADMIN,
  GUARD_CAN_ACCESS_GROUP_FROM_BODY,
  taxonomy.createTaxonomyItem
);
router.patch('/:itemId', GUARD_GROUP_ADMIN, taxonomy.updateTaxonomyItem);
router.delete('/:itemId', GUARD_GROUP_ADMIN, taxonomy.deleteTaxonomyItem);

// catch anything and forward to error handler
router.use((req, res, next) => {
  next(new createError.NotImplemented());
});

module.exports = router;
