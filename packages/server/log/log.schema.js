'use strict';

const { Schema } = require('mongoose');
const { UserModel } = require('../../server/constant/model.names');

const { ObjectId } = Schema.Types;

/**
 * @apiDefine log
 * @apiSuccess {String} id
 * @apiSuccess {String} query
 * @apiSuccess {Date} createdAt
 * @apiSuccess {Date} updatedAt
 */

const LogSchema = Schema(
  {
    // _user can't be required: admin doesn't set a _user
    _user: { type: ObjectId, ref: UserModel, alias: 'userId' },
    query: {
      type: String,
      required: [true, 'Query is required'],
    },
    responseStatus: {
      type: Number,
      required: [true, 'Response status is required'],
    },
    response: {
      type: String,
      required: [true, 'Response is required'],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = LogSchema;
