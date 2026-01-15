'use strict';

const asyncHandler = require('express-async-handler');
const createError = require('http-errors');
const { Users, Mailings } = require('../common/models.common.js');
const mongoose = require('mongoose');

module.exports = {
  createUser: asyncHandler(createUser),
  updateUser: asyncHandler(updateUser),
  findByGroupId: asyncHandler(findByGroupId),
  getPersistedLocalStorageKey,
  updatePersistedLocalStorageKey,
};

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
    Mailings.updateMany(
      { _user: userParams.userId },
      { author: userParams.name }
    ).then((result) => {
      console.log(result.nModified, 'mailings updated for', userParams.name);
    });
  }
  const updatedUser = await Users.findByIdAndUpdate(
    userParams.userId,
    userParams,
    {
      runValidators: true,
    }
  ).populate({
    path: '_company',
    select: 'id name',
  });
  return updatedUser;
}

async function findByGroupId(groupId) {
  const users = await Users.find({
    _company: mongoose.Types.ObjectId(groupId),
  });
  return users;
}

/**
 * Retrieves the value of a specific key in the user's localStorage persisted in the db.
 * @param {String} userId - The ID of the user.
 * @param {String} key - The key to retrieve.
 * @returns {Promise<*>} - The value associated with the key or undefined if it does not exist.
 */
async function getPersistedLocalStorageKey(userId, key) {
  const user = await Users.findById(userId).select('localStorage');
  if (!user) {
    throw new Error('User not found');
  }
  return user.localStorage?.get(key);
}

/**
 * Updates or adds a key-value pair in the user's localStorage persisted in the db.
 * @param {String} userId - The ID of the user.
 * @param {String} key - The key to update or add.
 * @param {*} value - The value to associate with the key (can be a string, an array, or null).
 * @returns {Promise<Object>} - The updated user object.
 */
async function updatePersistedLocalStorageKey(userId, key, value) {
  const user = await Users.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  if (!user.localStorage) user.localStorage = new Map();
  user.localStorage.set(key, value);
  return await user.save();
}
