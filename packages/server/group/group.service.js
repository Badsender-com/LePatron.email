'use strict'

const asyncHandler = require('express-async-handler');
const createError = require('http-errors');
const { Groups } = require('../common/models.common.js');

module.exports = {
  findById: asyncHandler(findById),
  createGroup: asyncHandler(createGroup),
}

async function findById(groupId) {
  const group = await Groups.findById(groupId).select('_id').lean();
  if (!group) {
    throw new createError.NotFound(`no group with id ${groupId} found`);
  }
  return group;
}

async function createGroup(groupParams) {
  const newGroup = await Groups.create(groupParams);
  return newGroup;
}
