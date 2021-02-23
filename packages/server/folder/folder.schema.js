'use strict';

const { Schema } = require('mongoose');
const { normalizeString } = require('../utils/model');
const { ObjectId } = Schema.Types;
const { FolderModel, WorkspaceModel } = require('../constant/model.names.js');

const FolderSchema = Schema(
  {
    name: {
      type: String,
      unique: true,
      set: normalizeString,
      required: [true, 'Folder name is required'],
    },
    _workspace: {
      type: ObjectId,
      ref: WorkspaceModel,
      required: [true, 'Workspace is required'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

FolderSchema.add({
  _parentFolder: {
    type: ObjectId,
    ref: FolderModel,
    required: false,
  },
});

module.exports = FolderSchema;
