'use strict';

const asyncHandler = require('express-async-handler');
const createError = require('http-errors');
const { Groups } = require('../common/models.common.js');
const mongoose = require('mongoose');

module.exports = {
  findById: asyncHandler(findById),
  createGroup: asyncHandler(createGroup),
  updateGroup: asyncHandler(updateGroup),
};

async function findById(groupId) {
  const group = await Groups.findById(groupId).select('_id').lean();
  if (!group) {
    throw new createError.NotFound(`no group with id ${groupId} found`);
  }
  return group;
}

async function createGroup(group) {
  return Groups.create(group);
}

async function updateGroup(group) {
  const { id, ...otherProperties } = group;

  await Groups.updateOne(
    { _id: mongoose.Types.ObjectId(id) },
    { ...otherProperties }
  );
}
