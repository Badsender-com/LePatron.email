'use strict';

const { Schema, Types } = require('mongoose');
const mongooseHidden = require('mongoose-hidden')();
const { mapValues } = require('lodash');

const formatFilenameForJqueryFileupload = require('../helpers/format-filename-for-jquery-fileupload.js');

/**
 * @apiDefine galleryImages
 * @apiSuccess {Object[]} files
 * @apiSuccess {String} files.name image name
 * @apiSuccess {String} files.url used by mosaico editor
 * @apiSuccess {String} files.deleteUrl used by mosaico editor
 * @apiSuccess {String} files.thumbnailUrl used by mosaico editor
 * @apiSuccess {String} files.label human-readable label (falls back to file.name for non-migrated images)
 * @apiSuccess {String} files.source image origin (e.g. 'upload', 'dam_bynder')
 * @apiSuccess {Object} files.externalMetadata metadata from external sources (DAM, etc.)
 * @apiSuccess {String} files.uploadedAt ISO date the image joined the gallery
 * @apiSuccess {Number} files.width original width in pixels, null when unknown
 * @apiSuccess {Number} files.height original height in pixels, null when unknown
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
        return files.map((file) => ({
          ...formatFilenameForJqueryFileupload(file.name),
          label: file.label || file.name,
          source: file.source || 'upload',
          externalMetadata: file.externalMetadata || {},
          uploadedAt: file.uploadedAt || null,
          // original dimensions; null for anything uploaded before US-09, and
          // for an upload whose bytes could not be probed
          width: file.width || null,
          height: file.height || null,
        }));
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

  // Copy what is stored, not what the getter shows: read through it, an image
  // from before the V1 fields would come back with its fallbacks (a label
  // equal to its file name, a null date) written down as real values, and
  // the migration could no longer tell it apart from a labelled one.
  const storedFiles = this.get('files', null, { getters: false }) || [];
  const files = storedFiles.map((file) =>
    mapValues(file, (value) =>
      typeof value === 'string'
        ? value.replace(oldCreationId, newCreationId)
        : value
    )
  );
  this.set('files', files);

  this.markModified('files');

  return this;
};

module.exports = GallerySchema;
