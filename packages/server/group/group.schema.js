'use strict';

const { Schema } = require('mongoose');
const mongooseHidden = require('mongoose-hidden')();

const { trimString } = require('../utils/model');
const { encrypt, decrypt } = require('../utils/crpyto');
const Status = require('./status');
/**
 * @apiDefine group
 * @apiSuccess {String} id
 * @apiSuccess {String} name
 * @apiSuccess {Date} createdAt
 * @apiSuccess {Date} updatedAt
 * @apiSuccess {Boolean} downloadMailingWithoutEnclosingFolder if we want to zip with an enclosing folder
 * @apiSuccess {Boolean} downloadMailingWithCdnImages if the images path of the downloaded archive should point to a CDN
 * @apiSuccess {String} cdnProtocol the protocol of the CDN
 * @apiSuccess {String} cdnEndPoint the CDN endpoint
 * @apiSuccess {String} cdnButtonLabel what will be the label of the `download CDN` button on the interface
 * @apiSuccess {Array[String]} colorScheme array of colors in hexadecimal used to define a custom color scheme
 */

const GroupSchema = Schema(
  {
    name: {
      type: String,
      required: [true, 'A name is required'],
      // http://mongoosejs.com/docs/api.html#schematype_SchemaType-unique
      // from mongoose doc:
      // violating the constraint returns an E11000 error from MongoDB when saving, not a Mongoose validation error.
      unique: true,
      set: trimString,
    },
    status: {
      type: String,
      enum: [Status.DEMO, Status.INACTIVE, Status.ACTIVE],
      required: [true, 'A status is required'],
    },
    userHasAccessToAllWorkspaces: {
      type: Boolean,
      default: true,
    },
    downloadMailingWithoutEnclosingFolder: {
      type: Boolean,
      default: false,
    },
    // cdn settings
    downloadMailingWithCdnImages: {
      type: Boolean,
      default: false,
    },
    cdnProtocol: {
      type: String,
      default: 'http://',
    },
    cdnEndPoint: {
      type: String,
    },
    cdnButtonLabel: {
      type: String,
      set: trimString,
      default: 'CDN',
    },
    // ftp settings
    downloadMailingWithFtpImages: {
      type: Boolean,
      default: false,
    },
    ftpProtocol: {
      type: String,
      default: 'sftp',
    },
    ftpHost: {
      type: String,
      default: '',
    },
    ftpUsername: {
      type: String,
      default: '',
    },
    ftpPassword: {
      type: String,
      default: '',
    },
    ftpPort: {
      type: Number,
      default: 22,
    },
    ftpPathOnServer: {
      type: String,
      default: './',
    },
    ftpEndPoint: {
      type: String,
      default: '',
    },
    ftpEndPointProtocol: {
      type: String,
      default: 'http://',
    },
    ftpButtonLabel: {
      type: String,
      set: trimString,
      default: 'FTP',
    },
    entryPoint: {
      type: String,
      default: '',
    },
    issuer: {
      type: String,
      default: '',
    },
    colorScheme: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

// easily hide keys from toJSON
// https://www.npmjs.com/package/mongoose-hidden
GroupSchema.plugin(mongooseHidden, { hidden: { _id: true, __v: true } });

// GroupSchema.virtual(`url`).get(function() {
//   return {
//     show: `/groups/${this._id}`,
//     delete: `/groups/${this._id}/delete`,
//     newUser: `/groups/${this._id}/new-user`,
//     newWireframe: `/groups/${this._id}/new-wireframe`,
//   }
// })

GroupSchema.pre('updateOne', function (next) {
  const ftpPassword = this.getUpdate()?.ftpPassword;
  if (ftpPassword) {
    this.getUpdate().ftpPassword = encrypt(ftpPassword);
  }
  next();
});

GroupSchema.post('findOne', function (result) {
  if (result.ftpPassword?.length > 32) {
    result.ftpPassword = decrypt(result.ftpPassword);
  }
});

module.exports = GroupSchema;
