'use strict'

const asyncHandler = require('express-async-handler');
const createError = require('http-errors');
const { Users, Mailings } = require('../common/models.common.js');

module.exports = {
  createUser: asyncHandler(createUser),
  updateUser: asyncHandler(updateUser),
  findByGroupId: asyncHandler(findByGroupId),
}

async function createUser(userParams) {
  const newUser = await Users.create({
    _company: userParams.groupId,
    role: userParams.role,
    ...userParams,
  });
  const user = await Users.findOneForApi({ _id: newUser._id });
  return user;
}

async function updateUser(userParams) {
  const user = await Users.findOneForApi({ _id: userParams.userId });
  if (!user) {
    throw new createError.NotFound();
  }
  // we don't need for this DB request to finish to give the user the response
  const nameChanged = user.name !== userParams.name;
  if (nameChanged) {
    Mailings.updateMany({ _user: userParams.userId }, { author: userParams.name }).then(
      (result) => {
        console.log(result.nModified, 'mailings updated for', userParams.name);
      }
    );
  }
  const updatedUser = await Users.findByIdAndUpdate(userParams.userId, userParams, {
    runValidators: true,
  }).populate({
    path: '_company',
    select: 'id name',
  });
  return updatedUser;
}

async function findByGroupId(groupId) {
  const users = await Users.where('_company.id').equals(groupId);
  return users;
}
