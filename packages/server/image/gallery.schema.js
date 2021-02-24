'use strict';

const { Schema, Types } = require('mongoose');
const mongooseHidden = require('mongoose-hidden')();

const formatFilenameForJqueryFileupload = require('../helpers/format-filename-for-jquery-fileupload.js');

/**
 * @apiDefine galleryImages
 * @apiSuccess {Object[]} files
 * @apiSuccess {String} files.name image name
 * @apiSuccess {String} files.url used by mosaico editor
 * @apiSuccess {String} files.deleteUrl used by mosaico editor
 * @apiSuccess {String} files.thumbnailUrl used by mosaico editor
 */

// This table is used to add a visible information on the images
const GallerySchema = Schema(
  {
    creationOrWireframeId: {
      type: Types.ObjectId,
      unique: true,
      required: true,
    },
    files: {
      type: [],
      // make sure we have the right format for a gallery
      get: (files) => {
        return files.map((file) =>
          formatFilenameForJqueryFileupload(file.name)
        );
      },
    },
  },
  { timestamps: true, toJSON: { getters: true } }
);

// easily hide keys from toJSON
// https://www.npmjs.com/package/mongoose-hidden
GallerySchema.plugin(mongooseHidden, { hidden: { _id: true, __v: true } });

// http://stackoverflow.com/questions/18324843/easiest-way-to-copy-clone-a-mongoose-document-instance#answer-25845569
GallerySchema.methods.duplicate = function duplicate(newCreationId) {
  const newId = Types.ObjectId();
  const oldCreationId = String(this.creationOrWireframeId);

  this._id = newId;
  this.isNew = true;
  this.creationOrWireframeId = newCreationId;

  // update the files names & path
  this.files = this.files.map((file) => {
    Object.keys(file).forEach((key) => {
      file[key] = file[key].replace(oldCreationId, newCreationId);
    });
    return file;
  });

  this.markModified('files');

  return this;
};

module.exports = GallerySchema;
