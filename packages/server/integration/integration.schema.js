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
 * @apiSuccess {String} type - Integration type (ai, data_feed, etc.)
 * @apiSuccess {String} provider - Provider identifier (openai, mistral, etc.)
 * @apiSuccess {String} _company - Reference to Group
 * @apiSuccess {Boolean} isActive
 * @apiSuccess {String} validationStatus
 * @apiSuccess {Date} lastValidatedAt
 * @apiSuccess {Date} createdAt
 * @apiSuccess {Date} updatedAt
 */
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
    // Encrypted credentials
    apiKey: {
      type: String,
      required: [true, 'API key is required'],
    },
    // Optional API host for self-hosted instances
    apiHost: {
      type: String,
      required: false,
    },
    // Provider-specific configuration
    config: {
      type: Schema.Types.Mixed,
      default: {},
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
