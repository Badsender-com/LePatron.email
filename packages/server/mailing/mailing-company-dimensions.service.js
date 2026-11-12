'use strict';

const mongoose = require('mongoose');
const { UnprocessableEntity, NotFound, Forbidden } = require('http-errors');

const {
  TaxonomyDimensions,
  TaxonomyItems,
} = require('../common/models.common.js');
const ERROR_CODES = require('../constant/error-codes.js');
const { StandardDimensionNames } = require('../constant/taxonomy-type.js');

/**
 * The company dimensions an email carries (ADR-0014): one list of values, at most
 * one per dimension, every one optional. The email type and the trigger keep
 * their own fields, so their values never travel in this list.
 *
 * Apart from mailing-metadata.service.js, which owns the endpoint and the other
 * fields: this is the one field whose rules depend on the company's declared
 * dimensions.
 */
module.exports = {
  validateTaxonomyItemIds,
  buildEditorDimensions,
};

const invalid = () =>
  new UnprocessableEntity(ERROR_CODES.INVALID_EMAIL_METADATA);

const asObjectId = (value) => mongoose.Types.ObjectId(String(value));

/**
 * Check the values a request sends for the company dimensions.
 *
 * Nothing is rewritten silently: a value the email already carries is kept as
 * it is sent back, even once it or its dimension has been deactivated. Only a
 * value the request newly chooses must be active, under an active dimension, so
 * an email in progress never becomes impossible to save because of a setting
 * changed elsewhere.
 *
 * @param {*} rawIds the request's `taxonomyItemIds`; `null` or `[]` clears them
 * @param {Object} options
 * @param {string|null} options.companyId the mailing's company
 * @param {Array} [options.currentIds] the values the email carries
 * @returns {Promise<ObjectId[]>} the values to store
 */
async function validateTaxonomyItemIds(rawIds, { companyId, currentIds = [] }) {
  if (rawIds === null) return [];
  if (!Array.isArray(rawIds)) throw invalid();
  if (rawIds.length === 0) return [];

  // Strings only: a number or an object is no id, and an object would reach the
  // query as an operator.
  const ids = rawIds.map((rawId) => {
    if (typeof rawId !== 'string' || !mongoose.Types.ObjectId.isValid(rawId)) {
      throw invalid();
    }
    return rawId;
  });
  if (new Set(ids).size !== ids.length) throw invalid();

  // Same refusal as for the email type: with no company, nothing to check the
  // values against.
  if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
    throw new Forbidden(ERROR_CODES.EMAIL_TYPE_COMPANY_MISSING);
  }

  const items = await TaxonomyItems.find({
    _id: { $in: ids.map(asObjectId) },
    _company: asObjectId(companyId),
  })
    .select({ type: 1, isActive: 1 })
    .lean();

  // A value of another company reads as "not found": the caller learns nothing
  // about what exists elsewhere.
  if (items.length !== ids.length) {
    throw new NotFound(ERROR_CODES.TAXONOMY_ITEM_NOT_FOUND);
  }

  const types = items.map((item) => item.type);
  if (types.some((type) => StandardDimensionNames.includes(type))) {
    throw invalid();
  }
  if (new Set(types).size !== types.length) throw invalid();

  const carried = new Set((currentIds || []).map(String));
  const chosen = items.filter((item) => !carried.has(String(item._id)));
  await assertChosenAreOffered(chosen, companyId);

  return items.map((item) => item._id);
}

async function assertChosenAreOffered(chosen, companyId) {
  if (chosen.length === 0) return;
  if (chosen.some((item) => !item.isActive)) throw invalid();

  const activeDimensions = await TaxonomyDimensions.find({
    _company: asObjectId(companyId),
    name: { $in: chosen.map((item) => item.type) },
    isActive: true,
  })
    .select({ name: 1 })
    .lean();
  const active = new Set(activeDimensions.map((dimension) => dimension.name));
  if (chosen.some((item) => !active.has(item.type))) throw invalid();
}

/**
 * The company dimensions the editor offers a select for: the active ones, in
 * their declared order, each with its active values and the deactivated values
 * the email carries, so the select still shows what the email has. Each value
 * carries its identifier, which the editor publishes to the template.
 *
 * @param {Object} options
 * @param {ObjectId|string} options.companyId the mailing's company
 * @param {Array} [options.currentIds] the values the email carries
 * @returns {Promise<Object[]>}
 */
async function buildEditorDimensions({ companyId, currentIds = [] }) {
  const dimensions = await TaxonomyDimensions.find({
    _company: companyId,
    isActive: true,
    name: { $nin: StandardDimensionNames },
  })
    .select({ name: 1, label: 1, order: 1 })
    .sort({ order: 1, name: 1 })
    .lean();
  if (dimensions.length === 0) return [];

  const carried = (currentIds || []).map(asObjectId);
  const values = await TaxonomyItems.find({
    _company: companyId,
    type: { $in: dimensions.map((dimension) => dimension.name) },
    $or: [{ isActive: true }, { _id: { $in: carried } }],
  })
    .select({ type: 1, label: 1, canonicalType: 1, isActive: 1, order: 1 })
    .sort({ order: 1, label: 1 })
    .lean();

  return dimensions.map((dimension) => ({
    name: dimension.name,
    label: dimension.label,
    values: values
      .filter((value) => value.type === dimension.name)
      .map((value) => ({
        id: value._id,
        label: value.label,
        // The identifier the template reads (ADR-0015), published by the editor.
        canonicalType: value.canonicalType,
        isActive: value.isActive,
      })),
  }));
}
