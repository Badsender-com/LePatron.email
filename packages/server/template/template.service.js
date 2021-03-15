'use strict';

const asyncHandler = require('express-async-handler');

const { Templates, Workspaces } = require('../common/models.common.js');

module.exports = {
  findOne: asyncHandler(findOne),
};

async function findOne(query) {
  return Templates.findOne(query).select({
    name: 1,
    _id: 1,
  });
}


