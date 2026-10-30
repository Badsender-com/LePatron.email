'use strict';

const express = require('express');
const createError = require('http-errors');

const router = express.Router();

const { GUARD_GROUP_ADMIN } = require('../account/auth.guard.js');
const {
  GUARD_CAN_ACCESS_GROUP_FROM_BODY,
  GUARD_CAN_ACCESS_GROUP_FROM_QUERY,
} = require('../group/group.guard.js');
const dimension = require('./controllers/dimension.controller.js');

// The dimensions a company declines its emails by (ADR-0014). A resource of its
// own, not a path under /taxonomy-items: a value belongs to a dimension, and
// nesting the two would make "dimensions" a candidate itemId.
//
// Company admins and tech admins only, the read included: it answers how the
// company is organised. A user filling in an email receives the active
// dimensions with the email itself. Not gated by `emailMetadata.enabled`, like
// the values: a company is prepared before the metadata are switched on.
router.get(
  '',
  GUARD_GROUP_ADMIN,
  GUARD_CAN_ACCESS_GROUP_FROM_QUERY,
  dimension.listDimensions
);
router.post(
  '',
  GUARD_GROUP_ADMIN,
  GUARD_CAN_ACCESS_GROUP_FROM_BODY,
  dimension.createDimension
);
// The service bounds the dimension to the caller's company in the same query.
router.patch('/:dimensionId', GUARD_GROUP_ADMIN, dimension.updateDimension);
router.delete('/:dimensionId', GUARD_GROUP_ADMIN, dimension.deleteDimension);

// catch anything and forward to error handler
router.use((req, res, next) => {
  next(new createError.NotImplemented());
});

module.exports = router;
