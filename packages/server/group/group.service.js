'use strict';

const asyncHandler = require('express-async-handler');
const createError = require('http-errors');
const { Groups, Users } = require('../common/models.common.js');
const mongoose = require('mongoose');

module.exports = {
  findById: asyncHandler(findById),
  createGroup: asyncHandler(createGroup),
  updateGroup: asyncHandler(updateGroup),
  findUserByGroupId: asyncHandler(findUserByGroupId),
};

async function findById(groupId) {
  const group = await Groups.findById(groupId).select('_id').lean();
  if (!group) {
    throw new createError.NotFound(`no group with id ${groupId} found`);
  }
  return group;
}

async function findUserByGroupId(groupId) {
  const [group, users] = await Promise.all([
    Groups.findById(groupId).select('_id'),
    Users.find({
      _company: groupId,
    })
      .populate({ path: '_company', select: 'id name entryPoint issuer' })
      .sort({ email: 1 }),
  ]);
  if (!group) throw new createError.NotFound();
  return users;
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
