'use strict';
const { Schema } = require('mongoose');
const { ObjectId } = Schema.Types;
const { GroupModel } = require('../constant/model.names.js');
const EspTypes = require('../constant/esp-type');
const encryptionPlugin = require('../utils/encryption-plugin.js');
/**
 * @apiDefine profile
 * @apiSuccess {String} id
 * @apiSuccess {String} name
 * @apiSuccess {Date} createdAt
 * @apiSuccess {Date} createdAt
 * @apiSuccess {String} _group
 * @apiSuccess {Object} data the profile's data inserted by the Group admin
 */
const ProfileSchema = Schema(
  {
    name: {
      type: String,
      required: [true, 'Profile name is required'],
    },
    type: {
      type: String,
      enum: [
        EspTypes.ACTITO,
        EspTypes.SENDINBLUE,
        EspTypes.DSC,
        EspTypes.ADOBE,
      ],
      required: false,
    },
    _company: {
      type: ObjectId,
      ref: GroupModel,
      alias: 'group',
    },
    apiKey: {
      type: String,
      required: true,
    },
    secretKey: {
      type: String,
      required: false,
    },
    accessToken: {
      type: String,
      required: false,
    },
    // http://mongoosejs.com/docs/schematypes.html#mixed
    additionalApiData: {},
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

ProfileSchema.plugin(encryptionPlugin, ['secretKey', 'accessToken']);

module.exports = ProfileSchema;
