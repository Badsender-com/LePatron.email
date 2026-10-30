'use strict';

const { Schema } = require('mongoose');
const { ObjectId } = Schema.Types;

const { trimString } = require('../../utils/model');
const { GroupModel } = require('../../constant/model.names.js');
const {
  DIMENSION_NAME_PATTERN,
  TaxonomyLimits,
} = require('../../constant/taxonomy-type.js');

// Same guard as taxonomy.schema.js: `trimString` would store the literal string
// "undefined" for a cleared field.
const trimOptionalString = (value) =>
  value === undefined || value === null ? value : trimString(value);

/**
 * @apiDefine taxonomyDimension
 * @apiSuccess {String} id
 * @apiSuccess {String} name what a template reads, write-once (ADR-0015)
 * @apiSuccess {String} label the company's own word for it
 * @apiSuccess {String} description what this dimension means for the company
 * @apiSuccess {Boolean} standard the email type or the trigger (ADR-0014)
 * @apiSuccess {Boolean} isActive
 * @apiSuccess {Number} order display position
 * @apiSuccess {Number} precedence who wins a design token two dimensions carry
 */

/**
 * A dimension a company declines its emails by (ADR-0014). The email type and
 * the trigger are standard and seeded for every company; every other one is
 * declared by the company.
 *
 * A collection rather than an enum: the dimensions a product would list are not
 * the ones a company has, and a dimension of its own should need an admin, not a
 * release.
 */
const TaxonomyDimensionSchema = Schema(
  {
    _company: {
      type: ObjectId,
      ref: GroupModel,
      required: [true, 'company is required'],
      alias: 'group',
    },
    // What a template reads, and what a value names as its `type`. Write-once:
    // renaming it would stop every template reading it, without a word.
    name: {
      type: String,
      required: [true, 'name is required'],
      set: trimOptionalString,
      maxlength: TaxonomyLimits.CANONICAL_TYPE,
      match: [DIMENSION_NAME_PATTERN, 'name must be a template property name'],
    },
    label: {
      type: String,
      required: [true, 'label is required'],
      set: trimOptionalString,
      maxlength: TaxonomyLimits.LABEL,
    },
    // Written for two readers: the admin who decides what belongs here, and the
    // AI features that read it as context.
    description: {
      type: String,
      maxlength: TaxonomyLimits.DESCRIPTION,
    },
    // Set by the seed only, never by a request.
    standard: {
      type: Boolean,
      default: false,
    },
    // Reversible: a deactivated dimension is no longer offered on an email, and
    // the values emails already carry stay on them.
    isActive: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    // Highest wins a token two dimensions carry. Not `order`: a company may list
    // a dimension first and want it resolved last.
    precedence: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// The name is the contract: one company may not declare it twice.
TaxonomyDimensionSchema.index({ _company: 1, name: 1 }, { unique: true });

module.exports = TaxonomyDimensionSchema;
