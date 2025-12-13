'use strict';

const { Schema } = require('mongoose');
const { ObjectId } = Schema.Types;
const { GroupModel, IntegrationModel } = require('../constant/model.names.js');
const AIFeatureTypes = require('../constant/ai-feature-type.js');

/**
 * @apiDefine aiFeatureConfig
 * @apiSuccess {String} id
 * @apiSuccess {String} _company - Reference to Group
 * @apiSuccess {Array} features - List of feature configurations
 * @apiSuccess {Date} createdAt
 * @apiSuccess {Date} updatedAt
 */

/**
 * Sub-schema for individual feature configuration
 */
const FeatureConfigSchema = Schema(
  {
    featureType: {
      type: String,
      enum: Object.values(AIFeatureTypes),
      required: [true, 'Feature type is required'],
    },
    integration: {
      type: ObjectId,
      ref: IntegrationModel,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    config: {
      // For translation feature
      availableLanguages: {
        type: [String],
        default: [],
      },
      defaultSourceLanguage: {
        type: String,
        default: 'auto',
      },
      // AI model to use (e.g., gpt-4o, gpt-4o-mini, mistral-large-latest)
      model: {
        type: String,
        default: null,
      },
      // For future features (text_generation, etc.)
      // editorialGuidelines: String,
      // customInstructions: String,
    },
  },
  { _id: false }
);

const AIFeatureConfigSchema = Schema(
  {
    _company: {
      type: ObjectId,
      ref: GroupModel,
      alias: 'group',
      required: [true, 'Group is required'],
      unique: true,
    },
    features: {
      type: [FeatureConfigSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index for fast lookups by group
AIFeatureConfigSchema.index({ _company: 1 });

module.exports = AIFeatureConfigSchema;
