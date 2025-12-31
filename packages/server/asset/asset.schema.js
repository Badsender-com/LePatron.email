'use strict';

const { Schema } = require('mongoose');
const { ObjectId } = Schema.Types;
const mongooseHidden = require('mongoose-hidden')();

const { GroupModel } = require('../constant/model.names.js');
const AssetTypes = require('../constant/asset-type.js');
const SftpAuthTypes = require('../constant/sftp-auth-type.js');
const encryptionPlugin = require('../utils/encryption-plugin.js');

/**
 * @apiDefine asset
 * @apiSuccess {String} id
 * @apiSuccess {String} name
 * @apiSuccess {String} type (sftp | s3)
 * @apiSuccess {Date} createdAt
 * @apiSuccess {Date} updatedAt
 * @apiSuccess {String} _company Group reference
 * @apiSuccess {Object} sftp SFTP configuration (if type is sftp)
 * @apiSuccess {Object} s3 S3 configuration (if type is s3)
 * @apiSuccess {String} publicEndpoint Public URL for images
 * @apiSuccess {Boolean} isActive Whether the asset is active
 */

const AssetSchema = Schema(
  {
    name: {
      type: String,
      required: [true, 'Asset name is required'],
      trim: true,
    },
    _company: {
      type: ObjectId,
      ref: GroupModel,
      required: [true, 'Company reference is required'],
      alias: 'group',
    },
    type: {
      type: String,
      enum: [AssetTypes.SFTP, AssetTypes.S3],
      required: [true, 'Asset type is required'],
    },
    // SFTP Configuration
    sftp: {
      host: {
        type: String,
        default: '',
      },
      port: {
        type: Number,
        default: 22,
      },
      username: {
        type: String,
        default: '',
      },
      authType: {
        type: String,
        enum: [SftpAuthTypes.PASSWORD, SftpAuthTypes.SSH_KEY],
        default: SftpAuthTypes.PASSWORD,
      },
      password: {
        type: String,
        default: '',
      },
      sshKey: {
        type: String,
        default: '',
      },
      pathOnServer: {
        type: String,
        default: './',
      },
    },
    // S3 Configuration
    s3: {
      endpoint: {
        type: String,
        default: '',
      },
      region: {
        type: String,
        default: '',
      },
      bucket: {
        type: String,
        default: '',
      },
      accessKeyId: {
        type: String,
        default: '',
      },
      secretAccessKey: {
        type: String,
        default: '',
      },
      pathPrefix: {
        type: String,
        default: '',
      },
      forcePathStyle: {
        type: Boolean,
        default: false,
      },
    },
    // Public endpoint for accessing uploaded images
    publicEndpoint: {
      type: String,
      required: [true, 'Public endpoint is required'],
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Unique index per company and name
AssetSchema.index({ _company: 1, name: 1 }, { unique: true });

// Hide internal fields
AssetSchema.plugin(mongooseHidden, { hidden: { _id: false, __v: true } });

// Encrypt sensitive credentials
AssetSchema.plugin(encryptionPlugin, [
  'sftp.password',
  'sftp.sshKey',
  's3.secretAccessKey',
]);

module.exports = AssetSchema;
