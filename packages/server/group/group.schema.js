'use strict'

const { Schema } = require('mongoose')
const mongooseHidden = require('mongoose-hidden')()

const { normalizeString, trimString } = require('../utils/model')

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
      set: normalizeString,
    },
    downloadMailingWithoutEnclosingFolder: {
      type: Boolean,
      default: false,
    },
    //cdn settings
    downloadMailingWithCdnImages: {
      type: Boolean,
      default: false,
    },
    cdnProtocol: {
      type: String,
      default: `http://`,
    },
    cdnEndPoint: {
      type: String,
      set: normalizeString,
    },
    cdnButtonLabel: {
      type: String,
      set: trimString,
      default: `CDN`,
    },
    //ftp settings
    downloadMailingWithFtpImages: {
      type: Boolean,
      default: false,
    },
    ftpProtocol: {
      type: String,
      default: `sftp`,
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
      default: `FTP`,
    },
    entryPoint: {
      type: String,
      default: ``,
    },
    issuer: {
      type: String,
      default: ``,
    },
  },
  { timestamps: true, toJSON: { virtuals: true } },
)

// easily hide keys from toJSON
// https://www.npmjs.com/package/mongoose-hidden
GroupSchema.plugin(mongooseHidden, { hidden: { _id: true, __v: true } })

// GroupSchema.virtual(`url`).get(function() {
//   return {
//     show: `/groups/${this._id}`,
//     delete: `/groups/${this._id}/delete`,
//     newUser: `/groups/${this._id}/new-user`,
//     newWireframe: `/groups/${this._id}/new-wireframe`,
//   }
// })

module.exports = GroupSchema
