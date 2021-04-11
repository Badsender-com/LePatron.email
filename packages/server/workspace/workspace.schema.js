'use strict';

const { Schema } = require('mongoose');
const { normalizeString } = require('../utils/model');
const {
  GroupModel,
  UserModel,
  FolderModel,
} = require('../constant/model.names.js');
const logger = require('../utils/logger.js');
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
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

WorkspaceSchema.virtual('folders', {
  ref: FolderModel,
  localField: '_id',
  foreignField: '_workspace',
  justOne: false,
});

WorkspaceSchema.pre('find', function () {
  this._startTime = Date.now();
});

WorkspaceSchema.post('find', function () {
  if (this._startTime != null) {
    logger.log('find Workspace Runtime: ', Date.now() - this._startTime);
  }
  this._startTime = null;
});

module.exports = WorkspaceSchema;
