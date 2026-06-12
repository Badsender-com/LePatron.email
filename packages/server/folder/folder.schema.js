'use strict';

const { Schema } = require('mongoose');
const { ObjectId } = Schema.Types;
const { FolderModel, WorkspaceModel } = require('../constant/model.names.js');

/**
 * @apiDefine folder
 * @apiSuccess {String} id
 * @apiSuccess {String} name
 * @apiSuccess {Date} createdAt
 * @apiSuccess {Date} updatedAt
 * @apiSuccess {String} _workspace if we want to directly link the folder to a workspace
 * @apiSuccess {String} _parentFolder if we want to directly link the folder to another parent folder
 */

const FolderSchema = Schema(
  {
    name: {
      type: String,
      required: [true, 'Folder name is required'],
    },
    _workspace: {
      type: ObjectId,
      ref: WorkspaceModel,
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

FolderSchema.virtual('childFolders', {
  ref: FolderModel,
  localField: '_id',
  foreignField: '_parentFolder',
  justOne: false,
});

FolderSchema.index({ _parentFolder: 1 });
// Serves "root folders of a workspace" ({ _workspace, _parentFolder: null })
// and "children of a folder" ({ _parentFolder }) for the lazy-loaded tree.
FolderSchema.index({ _workspace: 1, _parentFolder: 1 });

module.exports = FolderSchema;
