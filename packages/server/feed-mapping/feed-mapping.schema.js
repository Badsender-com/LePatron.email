'use strict';

const { Schema } = require('mongoose');
const { ObjectId } = Schema.Types;
const {
  GroupModel,
  IntegrationModel,
  TemplateModel,
} = require('../constant/model.names.js');

/**
 * @apiDefine feedMapping
 * @apiSuccess {String} id
 * @apiSuccess {String} _company Reference to Group
 * @apiSuccess {String} _integration Reference to the feed source Integration
 * @apiSuccess {String} _template Reference to Template
 * @apiSuccess {String} blockName Block type this mapping targets (e.g. "articlesBlock")
 * @apiSuccess {Object[]} fieldMapping One entry per column (1-4): { [blockFieldPath]: feedPropertyName }
 * @apiSuccess {String} ctaDefaultLabel Default CTA button label applied on insertion
 * @apiSuccess {Boolean} isActive
 * @apiSuccess {Date} createdAt
 * @apiSuccess {Date} updatedAt
 */

const FeedMappingSchema = Schema(
  {
    _company: {
      type: ObjectId,
      ref: GroupModel,
      alias: 'group',
      required: [true, 'Group is required'],
    },
    _integration: {
      type: ObjectId,
      ref: IntegrationModel,
      required: [true, 'Feed integration is required'],
    },
    _template: {
      type: ObjectId,
      ref: TemplateModel,
      required: [true, 'Template is required'],
    },
    blockName: {
      type: String,
      required: [true, 'Block name is required'],
    },
    // One entry per column: a single-column block (the common case) has
    // exactly one; a multi-column block (e.g. a 3-across article block) has
    // one per column, so selecting N feed items fills N columns of the same
    // block instance instead of inserting N separate blocks. Each column is
    // a free-form { [blockFieldPath]: feedPropertyName } map — no block
    // field is mandatory, and the same feed property (e.g. "link") can back
    // more than one block field (e.g. both an image link and a CTA link).
    fieldMapping: {
      type: [Schema.Types.Mixed],
      required: [true, 'Field mapping is required'],
      validate: {
        validator: (columns) =>
          Array.isArray(columns) && columns.length >= 1 && columns.length <= 4,
        message: 'fieldMapping must have between 1 and 4 columns',
      },
    },
    ctaDefaultLabel: {
      type: String,
      default: '',
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

FeedMappingSchema.index({ _company: 1, _template: 1, blockName: 1 });

module.exports = FeedMappingSchema;
