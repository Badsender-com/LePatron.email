'use strict';

const { Schema } = require('mongoose');
const { normalizeString } = require('../utils/model');
const { GroupModel, UserModel } = require('../constant/model.names.js');
const { ObjectId } = Schema.Types;

/**
 * @apiDefine workspace
 * @apiSuccess {String} id
 * @apiSuccess {String} name
 * @apiSuccess {Date} createdAt
 * @apiSuccess {Date} updatedAt
 * @apiSuccess {String} _company group associated with the workspace
 * @apiSuccess {String} _users list of users that are part of the workspace
 */

const WorkspaceSchema = Schema(
  {
    name: {
      type: String,
      set: normalizeString,
      required: [true, 'Folder name is required'],
    },
    _company: {
      type: ObjectId,
      ref: GroupModel,
      required: [true, 'Group is required'],
      // Ideally we should have run a script to migrate fields
      // • don't have time
      // • so just make an alias
      alias: 'group',
    },
    _users: [
      {
        type: ObjectId,
        ref: UserModel,
        required: false,
      },
    ],
    description: {
      type: String,
      set: normalizeString,
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

WorkspaceSchema.virtual('folders', {
  ref: 'Folder',
  localField: '_id',
  foreignField: '_workspace',
  justOne: false,
});

module.exports = WorkspaceSchema;
