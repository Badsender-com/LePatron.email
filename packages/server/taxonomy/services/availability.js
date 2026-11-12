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
 * Nested dimensions and availability (ADR-0014). A dimension may hang under
 * another one, "Language" under "Market"; each value of the child dimension is
 * then offered under the parent values its availability lists, or under all of
 * them when it lists none.
 *
 * Nothing is rewritten silently: a parent value or a parent dimension something
 * still depends on cannot be removed, and the refusal gives the count.
 */
module.exports = {
  assertParentName,
  assertNoChildDimension,
  assertNoAvailabilityToMove,
  readAvailability,
  assertNotOfferedUnder,
};

const asObjectId = (value) => mongoose.Types.ObjectId(String(value));

/**
 * Check the dimension `name` may hang under `parentName`: a dimension of the
 * company, active, the email type included, never the trigger (its values are
 * not stored), itself or one of its own descendants.
 *
 * @param {Object} params
 * @param {ObjectId} params.companyId
 * @param {string} params.name the dimension being placed
 * @param {string|null} params.parentName null for the first level
 */
async function assertParentName({ companyId, name, parentName }) {
  if (parentName === null) return;
  const invalid = () => new BadRequest(ERROR_CODES.INVALID_DIMENSION);
  if (parentName === StandardDimensions.TRIGGER || parentName === name) {
    throw invalid();
  }

  const dimensions = await TaxonomyDimensions.find({ _company: companyId })
    .select({ name: 1, parentName: 1, isActive: 1 })
    .lean();
  const byName = new Map(dimensions.map((d) => [d.name, d]));
  const parent = byName.get(parentName);
  if (!parent || !parent.isActive) throw invalid();

  // Walking up from the parent must never meet the dimension itself: market
  // under its own language would make each the other's ancestor.
  const seen = new Set();
  for (let at = parent; at; at = byName.get(at.parentName)) {
    if (at.name === name || seen.has(at.name)) throw invalid();
    seen.add(at.name);
  }
}

/**
 * Refuse to delete a dimension another one hangs under: the child would point
 * at a name nothing declares, or at the next dimension declared under it.
 */
async function assertNoChildDimension(dimension) {
  const children = await TaxonomyDimensions.find({
    _company: dimension._company,
    parentName: dimension.name,
  })
    .select({ name: 1 })
    .lean();
  if (children.length === 0) return;

  const error = new Conflict(ERROR_CODES.DIMENSION_HAS_CHILDREN);
  error.details = { childNames: children.map((child) => child.name) };
  throw error;
}

/**
 * Refuse to move a dimension whose values carry an availability: it lists values
 * of the parent it leaves, and would offer them under none of the new one.
 */
async function assertNoAvailabilityToMove(dimension, parentName) {
  if ((dimension.parentName || null) === parentName) return;
  // Read and counted here: at most 200 values, and no query on an array's
  // length to keep in step with the in-memory collection of the tests.
  const values = await TaxonomyItems.find({
    _company: dimension._company,
    type: dimension.name,
  })
    .select({ _parents: 1 })
    .lean();
  const valueCount = values.filter((value) => (value._parents || []).length > 0)
    .length;
  if (valueCount === 0) return;

  const error = new Conflict(ERROR_CODES.DIMENSION_HAS_AVAILABILITY);
  error.details = { valueCount };
  throw error;
}

/**
 * The availability a request gives a value of the dimension `type`: values of
 * its parent dimension, in the same company.
 *
 * @param {Object} params
 * @param {ObjectId} params.companyId
 * @param {string} params.type the value's dimension
 * @param {string[]} params.parentIds
 * @returns {Promise<ObjectId[]>}
 */
async function readAvailability({ companyId, type, parentIds }) {
  if (parentIds.length === 0) return [];
  const invalid = () => new BadRequest(ERROR_CODES.INVALID_TAXONOMY_ITEM);

  const dimension = await TaxonomyDimensions.findOne({
    _company: companyId,
    name: type,
  })
    .select({ parentName: 1 })
    .lean();
  // A dimension at the first level offers its values everywhere.
  if (!dimension || !dimension.parentName) throw invalid();

  const parents = await TaxonomyItems.find({
    _id: { $in: parentIds.map(asObjectId) },
    _company: companyId,
    type: dimension.parentName,
  })
    .select({ _id: 1 })
    .lean();
  if (parents.length !== parentIds.length) throw invalid();

  return parentIds.map(asObjectId);
}

/**
 * Refuse to delete a value another value is offered under. Taking it out of
 * their availability would leave some of them with none, which means "offered
 * everywhere".
 */
async function assertNotOfferedUnder(item) {
  const childCount = await TaxonomyItems.countDocuments({
    _company: item._company,
    _parents: item._id,
  });
  if (childCount === 0) return;

  const error = new Conflict(ERROR_CODES.TAXONOMY_ITEM_IS_PARENT);
  error.details = { childCount };
  throw error;
}
