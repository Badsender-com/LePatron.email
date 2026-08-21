'use strict';

const { Schema } = require('mongoose');
const { ObjectId } = Schema.Types;

const { trimString } = require('../utils/model');
const { GroupModel } = require('../constant/model.names.js');
const {
  TaxonomyTypeValues,
  TaxonomyLimits,
} = require('../constant/taxonomy-type.js');

/**
 * @apiDefine taxonomyItem
 * @apiSuccess {String} id
 * @apiSuccess {String} type the taxonomy this item belongs to (eg. `emailType`)
 * @apiSuccess {String} label the label shown to users, freely editable
 * @apiSuccess {String} description the company's own definition of this item
 * @apiSuccess {String} canonicalType optional mapping onto the AI skills vocabulary
 * @apiSuccess {Boolean} isActive
 * @apiSuccess {Number} order
 * @apiSuccess {Object} group the company it belongs to
 */

const TaxonomyItemSchema = Schema(
  {
    _company: {
      type: ObjectId,
      ref: GroupModel,
      required: [true, 'company is required'],
      alias: 'group',
    },
    type: {
      type: String,
      enum: TaxonomyTypeValues,
      required: [true, 'type is required'],
    },
    // Each company uses its own words: "Infolettre", "Newsletter", "Black Friday".
    label: {
      type: String,
      required: [true, 'label is required'],
      set: trimString,
      // Bounded now, while the collection is still empty: adding a limit once
      // client data exists means a migration.
      maxlength: TaxonomyLimits.LABEL,
    },
    // The company's own definition of what this typology means for them. This is
    // the real editorial value of the taxonomy, and the future LLM context.
    description: {
      type: String,
      maxlength: TaxonomyLimits.DESCRIPTION,
    },
    // Optional bridge onto the AI skills vocabulary — see
    // constant/email-type-canonical.js for why it is not an enum here.
    canonicalType: {
      type: String,
      set: trimString,
      maxlength: TaxonomyLimits.CANONICAL_TYPE,
    },
    // Soft disable: an item still referenced by mailings must keep resolving, so
    // it is deactivated rather than deleted.
    isActive: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Two companies may use the same label; one company may not use it twice for the
// same taxonomy.
TaxonomyItemSchema.index({ _company: 1, type: 1, label: 1 }, { unique: true });
// Serves the select lists: active items of one taxonomy, in display order.
TaxonomyItemSchema.index({ _company: 1, type: 1, isActive: 1, order: 1 });

module.exports = TaxonomyItemSchema;
