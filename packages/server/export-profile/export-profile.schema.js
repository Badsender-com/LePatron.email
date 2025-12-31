'use strict';

const { Schema } = require('mongoose');
const { ObjectId } = Schema.Types;
const mongooseHidden = require('mongoose-hidden')();

const { GroupModel, ProfileModel, AssetModel } = require('../constant/model.names.js');
const DeliveryMethods = require('../constant/delivery-method.js');
const AssetMethods = require('../constant/asset-method.js');

/**
 * @apiDefine exportProfile
 * @apiSuccess {String} id
 * @apiSuccess {String} name
 * @apiSuccess {String} deliveryMethod (esp | download)
 * @apiSuccess {String} assetMethod (asset | zip | esp_api)
 * @apiSuccess {Date} createdAt
 * @apiSuccess {Date} updatedAt
 * @apiSuccess {String} _company Group reference
 * @apiSuccess {String} _espProfile ESP Profile reference (if deliveryMethod is esp)
 * @apiSuccess {String} _asset Asset reference (if assetMethod is asset)
 * @apiSuccess {Boolean} isActive Whether the export profile is active
 */

const ExportProfileSchema = Schema(
  {
    name: {
      type: String,
      required: [true, 'Export profile name is required'],
      trim: true,
    },
    _company: {
      type: ObjectId,
      ref: GroupModel,
      required: [true, 'Company reference is required'],
      alias: 'group',
    },
    // Delivery method: how the email is delivered
    deliveryMethod: {
      type: String,
      enum: [DeliveryMethods.ESP, DeliveryMethods.DOWNLOAD],
      required: [true, 'Delivery method is required'],
    },
    // Reference to ESP Profile (required if deliveryMethod is 'esp')
    _espProfile: {
      type: ObjectId,
      ref: ProfileModel,
      default: null,
    },
    // Asset method: how images are handled
    assetMethod: {
      type: String,
      enum: [AssetMethods.ASSET, AssetMethods.ZIP, AssetMethods.ESP_API],
      required: [true, 'Asset method is required'],
    },
    // Reference to Asset (required if assetMethod is 'asset')
    _asset: {
      type: ObjectId,
      ref: AssetModel,
      default: null,
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
ExportProfileSchema.index({ _company: 1, name: 1 }, { unique: true });

// Hide internal fields
ExportProfileSchema.plugin(mongooseHidden, { hidden: { _id: false, __v: true } });

// Custom validation
ExportProfileSchema.pre('validate', function (next) {
  // If deliveryMethod is 'esp', _espProfile is required
  if (this.deliveryMethod === DeliveryMethods.ESP && !this._espProfile) {
    this.invalidate('_espProfile', 'ESP Profile is required when delivery method is "esp"');
  }

  // If assetMethod is 'asset', _asset is required
  if (this.assetMethod === AssetMethods.ASSET && !this._asset) {
    this.invalidate('_asset', 'Asset is required when asset method is "asset"');
  }

  // If assetMethod is 'esp_api', deliveryMethod must be 'esp'
  if (this.assetMethod === AssetMethods.ESP_API && this.deliveryMethod !== DeliveryMethods.ESP) {
    this.invalidate('assetMethod', 'Asset method "esp_api" requires delivery method "esp"');
  }

  next();
});

module.exports = ExportProfileSchema;
