'use strict';

const mongoose = require('mongoose');
const { BadRequest, Conflict } = require('http-errors');

const {
  TaxonomyDimensions,
  TaxonomyItems,
} = require('../../common/models.common.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const { StandardDimensions } = require('../../constant/taxonomy-type.js');

/**
 * The defaults a company marks on its values (ADR-0024): at the first level one
 * value per dimension; for a child dimension, one value "default under" each
 * parent value, among the values offered there. A place already held is refused
 * with the value holding it, so the admin knows which one to unmark.
 */
module.exports = { assertDefaults };

const asObjectId = (value) => mongoose.Types.ObjectId(String(value));

/**
 * Check the defaults a request sets on a value, and store `defaultUnder` as ids.
 *
 * @param {Object} params
 * @param {ObjectId} params.companyId
 * @param {string} params.type the value's dimension
 * @param {Object} params.fields what the request writes, changed in place
 * @param {Object} [params.item] the value being updated, absent on creation
 */
async function assertDefaults({ companyId, type, fields, item }) {
  const exceptId = item && item._id;
  if (fields.isDefault) {
    await assertDefaultIsFree({ companyId, type, exceptId });
  }
  const availability =
    fields._parents !== undefined
      ? fields._parents
      : (item && item._parents) || [];
  // A narrowed availability takes away the defaults it no longer offers: a
  // value cannot be the default where it is not offered.
  if (
    fields.defaultUnder === undefined &&
    fields._parents !== undefined &&
    availability.length > 0 &&
    item &&
    (item.defaultUnder || []).length > 0
  ) {
    const offered = availability.map(String);
    fields.defaultUnder = item.defaultUnder.filter((id) =>
      offered.includes(String(id))
    );
    return;
  }
  if (fields.defaultUnder !== undefined && fields.defaultUnder.length > 0) {
    await assertDefaultUnderIsOffered({
      companyId,
      type,
      parentIds: fields.defaultUnder,
      availability,
    });
    await assertDefaultUnderIsFree({
      companyId,
      type,
      parentIds: fields.defaultUnder,
      exceptId,
    });
    fields.defaultUnder = fields.defaultUnder.map(asObjectId);
  }
}

const conflictWith = (holder) => {
  const error = new Conflict(ERROR_CODES.TAXONOMY_DEFAULT_TAKEN);
  error.details = { holder: holder.label };
  return error;
};

/**
 * One default per dimension. The email type keeps its own field on the email,
 * which no default fills: marking one is refused.
 */
async function assertDefaultIsFree({ companyId, type, exceptId }) {
  if (type === StandardDimensions.EMAIL_TYPE) {
    throw new BadRequest(ERROR_CODES.INVALID_TAXONOMY_ITEM);
  }

  const query = { _company: companyId, type, isDefault: true };
  if (exceptId) query._id = { $ne: exceptId };

  const holder = await TaxonomyItems.findOne(query).select({ label: 1 }).lean();
  if (holder) throw conflictWith(holder);
}

/**
 * The parent values a child value is default under: values of its parent
 * dimension it is offered under, every one of them when its availability is
 * empty.
 */
async function assertDefaultUnderIsOffered({
  companyId,
  type,
  parentIds,
  availability,
}) {
  const dimension = await TaxonomyDimensions.findOne({
    _company: companyId,
    name: type,
  })
    .select({ parentName: 1 })
    .lean();
  // A first-level value is the default with `isDefault`, and the email type's
  // values hang under no dimension of the list.
  if (!dimension || !dimension.parentName) {
    throw new BadRequest(ERROR_CODES.INVALID_TAXONOMY_ITEM);
  }

  const offered = availability.map(String);
  if (
    offered.length > 0 &&
    parentIds.some((id) => !offered.includes(String(id)))
  ) {
    throw new BadRequest(ERROR_CODES.TAXONOMY_DEFAULT_UNDER_NOT_OFFERED);
  }

  const parents = await TaxonomyItems.find({
    _id: { $in: parentIds.map(asObjectId) },
    _company: companyId,
    type: dimension.parentName,
  })
    .select({ _id: 1 })
    .lean();
  if (parents.length !== parentIds.length) {
    throw new BadRequest(ERROR_CODES.INVALID_TAXONOMY_ITEM);
  }
}

// One default under each parent value, within the dimension.
async function assertDefaultUnderIsFree({
  companyId,
  type,
  parentIds,
  exceptId,
}) {
  const query = {
    _company: companyId,
    type,
    defaultUnder: { $in: parentIds.map(asObjectId) },
  };
  if (exceptId) query._id = { $ne: exceptId };

  const holder = await TaxonomyItems.findOne(query).select({ label: 1 }).lean();
  if (holder) throw conflictWith(holder);
}
