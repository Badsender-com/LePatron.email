'use strict';

const { Schema } = require('mongoose');
const { normalizeString } = require('../utils/model');
const { GroupModel, UserModel } = require('../constant/model.names.js');
const { ObjectId } = Schema.Types;

const WorkSpaceSchema = Schema(
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

module.exports = WorkSpaceSchema;
