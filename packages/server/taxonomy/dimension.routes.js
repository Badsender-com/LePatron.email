'use strict';

const express = require('express');
const createError = require('http-errors');

const router = express.Router();

const { GUARD_GROUP_ADMIN, GUARD_CAN } = require('../account/auth.guard.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');
const {
  GUARD_CAN_ACCESS_GROUP_FROM_BODY,
  GUARD_CAN_ACCESS_GROUP_FROM_QUERY,
} = require('../group/group.guard.js');
const dimension = require('./controllers/dimension.controller.js');

const GUARD_TAXONOMY_MANAGE = GUARD_CAN(CAPABILITIES.TAXONOMY_MANAGE);

// The dimensions a company declines its emails by (ADR-0014). A resource of its
// own, not a path under /taxonomy-items: a value belongs to a dimension, and
// nesting the two would make "dimensions" a candidate itemId.
//
// The read is for company admins and tech admins: it answers how the company is
// organised. The writes ask for `taxonomy.manage` (ADR-0026): the tech admin's
// and the super admin's, not the company admin's, who reads. A user filling in an email receives the active
// dimensions with the email itself. Not gated by `emailMetadata.enabled`, like
// the values: a company is prepared before the metadata are switched on.
router.get(
  '',
  GUARD_GROUP_ADMIN,
  GUARD_CAN_ACCESS_GROUP_FROM_QUERY,
  dimension.listDimensions
);
// Before '/:dimensionId': the company's templates with their contract.
router.get(
  '/templates',
  GUARD_GROUP_ADMIN,
  GUARD_CAN_ACCESS_GROUP_FROM_QUERY,
  dimension.listTemplateContracts
);
router.put(
  '/precedence',
  GUARD_TAXONOMY_MANAGE,
  GUARD_CAN_ACCESS_GROUP_FROM_BODY,
  dimension.setPrecedence
);
router.put(
  '/order',
  GUARD_TAXONOMY_MANAGE,
  GUARD_CAN_ACCESS_GROUP_FROM_BODY,
  dimension.reorderDimensions
);
router.post(
  '',
  GUARD_TAXONOMY_MANAGE,
  GUARD_CAN_ACCESS_GROUP_FROM_BODY,
  dimension.createDimension
);
// The service bounds the dimension to the caller's company in the same query.
router.patch('/:dimensionId', GUARD_TAXONOMY_MANAGE, dimension.updateDimension);
router.delete(
  '/:dimensionId',
  GUARD_TAXONOMY_MANAGE,
  dimension.deleteDimension
);

// catch anything and forward to error handler
router.use((req, res, next) => {
  next(new createError.NotImplemented());
});

module.exports = router;
