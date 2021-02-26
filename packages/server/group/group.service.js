'use strict'

const _ = require('lodash');
const asyncHandler = require('express-async-handler');
const createError = require('http-errors');
const { Groups } = require('../common/models.common.js');

module.exports = {
  findById: asyncHandler(findById),
}

async function findById(groupId) {
  const group = await Groups.findById(groupId).select('_id').lean();
  if (!group) {
    throw new createError.BadRequest(`no group with id ${groupId} found`);
  }
  return group;
}

