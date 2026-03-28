'use strict';

const { Schema } = require('mongoose');
const { ObjectId } = Schema.Types;
const { GroupModel } = require('../constant/model.names.js');
const IntegrationTypes = require('../constant/integration-type.js');
const IntegrationProviders = require('../constant/integration-provider.js');
const encryptionPlugin = require('../utils/encryption-plugin.js');

/**
 * @apiDefine integration
 * @apiSuccess {String} id
 * @apiSuccess {String} name
 * @apiSuccess {String} type - Integration type (ai, dashboard, etc.)
 * @apiSuccess {String} provider - Provider identifier (metabase, openai, etc.)
 * @apiSuccess {String} _company - Reference to Group
 * @apiSuccess {Boolean} isActive
 * @apiSuccess {String} validationStatus
 * @apiSuccess {Date} lastValidatedAt
 * @apiSuccess {Date} createdAt
 * @apiSuccess {Date} updatedAt
 */

// Dashboard sub-schema for Metabase dashboards
const DashboardSchema = Schema(
  {
    metabaseId: {
      type: Number,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    lockedParams: {
      type: Schema.Types.Mixed,
      default: {},
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: true }
);

const IntegrationSchema = Schema(
  {
    name: {
      type: String,
      required: [true, 'Integration name is required'],
    },
    type: {
      type: String,
      enum: Object.values(IntegrationTypes),
      required: [true, 'Integration type is required'],
    },
    provider: {
      type: String,
      enum: Object.values(IntegrationProviders),
      required: [true, 'Provider is required'],
    },
    _company: {
      type: ObjectId,
      ref: GroupModel,
      alias: 'group',
      required: [true, 'Group is required'],
    },
    // Encrypted credentials - API key or secret key
    apiKey: {
      type: String,
      required: [true, 'API key is required'],
    },
    // API host for the provider (e.g., Metabase site URL)
    apiHost: {
      type: String,
      required: false,
    },
    // Provider-specific configuration (flexible schema)
    config: {
      type: Schema.Types.Mixed,
      default: {},
    },
    // Dashboard-specific: array of dashboards
    dashboards: {
      type: [DashboardSchema],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    validationStatus: {
      type: String,
      enum: ['pending', 'valid', 'invalid'],
      default: 'pending',
    },
    lastValidatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Apply encryption plugin for sensitive fields
IntegrationSchema.plugin(encryptionPlugin, ['apiKey']);

// Compound unique index: one integration with the same name per group and type
IntegrationSchema.index({ _company: 1, name: 1, type: 1 }, { unique: true });

module.exports = IntegrationSchema;
