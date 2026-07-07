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

const IntegrationSchema = Schema(
  {
    name: {
      type: String,
      required: [true, 'Integration name is required'],
      maxlength: [255, 'Name must be under 255 characters'],
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

// Hide sensitive fields from JSON output.
//
// Two adjustments compared to the plugin defaults:
//
// 1. `defaultHidden: { __v: true }` — mongoose-hidden hides `_id` by default,
//    but the UI references `integration._id` in 5 places (validate, dashboard
//    count, edit, delete, loading state) and breaks silently with `undefined`
//    in URLs when _id is dropped. We restore `_id` by overriding defaultHidden.
//
// 2. `autoHideObject: false` — without this, `apiKey` would also be stripped
//    from `doc.toObject()`, which the ProviderFactory uses internally to build
//    the provider instance. Stripping apiKey there breaks the actual
//    /validate call (provider gets `apiKey: undefined` → 401 from upstream
//    → validation reports false for every key). We only want apiKey hidden
//    in the HTTP/JSON response, not in server-side internals.
IntegrationSchema.plugin(
  require('mongoose-hidden')({
    defaultHidden: { __v: true },
    autoHideObject: false,
  }),
  {
    hidden: { apiKey: true },
  }
);

// Apply encryption plugin for sensitive fields
IntegrationSchema.plugin(encryptionPlugin, ['apiKey']);

// Compound unique index: one integration with the same name per group and type
IntegrationSchema.index({ _company: 1, name: 1, type: 1 }, { unique: true });

module.exports = IntegrationSchema;
