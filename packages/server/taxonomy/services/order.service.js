'use strict';

const { BadRequest } = require('http-errors');

const {
  TaxonomyDimensions,
  TaxonomyItems,
} = require('../../common/models.common.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const { StandardDimensions } = require('../../constant/taxonomy-type.js');
const { resolveCompanyId } = require('./company-scope.js');
const { withDimensionsLocked } = require('./dimension-lock.js');
const logger = require('../../utils/logger.js');

/**
 * Ordering by drag and drop (ADR-0026): a drop sends the whole new order of
 * what it moved among, which replaces the stored one. The list has to be
 * exactly what can be ordered there, or nothing changes: a list built on a
 * stale screen would otherwise leave two items on one position.
 */
module.exports = { reorderDimensions, reorderValues, setPrecedence };

// Spaced, so an order set by hand before stays readable beside these.
const positionOf = (index) => (index + 1) * 10;

// One round trip, under the claim of the dimensions the list orders: two drops
// at once never mix their positions.
const setEach = (Model, companyId, changes) =>
  Model.bulkWrite(
    changes.map(([filter, fields]) => ({
      updateOne: {
        filter: { _company: companyId, ...filter },
        update: { $set: fields },
      },
    })),
    { ordered: true }
  );

const names = (list) =>
  Array.isArray(list) && list.every((name) => typeof name === 'string');

const sameSet = (expected, given) =>
  given.length === expected.length &&
  new Set(given).size === given.length &&
  given.every((item) => expected.includes(item));

/**
 * The company's dimensions under one parent, in a new order. Moving one under
 * another parent is a separate, explicit action (it clears its defaults).
 *
 * @param {Object} params
 * @param {Object} params.user
 * @param {string} [params.groupId] the target company, super admin only
 * @param {string|null} params.parentName null for the first level
 * @param {string[]} params.names every company dimension under that parent
 */
async function reorderDimensions({
  user,
  groupId,
  parentName = null,
  names: ordered,
}) {
  logger.log('orderService:reorderDimensions');
  const companyId = resolveCompanyId(user, groupId);
  if (
    !names(ordered) ||
    (parentName !== null && typeof parentName !== 'string')
  ) {
    throw new BadRequest(ERROR_CODES.INVALID_DIMENSION);
  }
  await withDimensionsLocked({ companyId, names: ordered }, async () => {
    const dimensions = await TaxonomyDimensions.find({
      _company: companyId,
    }).lean();
    const siblings = dimensions
      .filter(
        (dimension) =>
          !dimension.standard && (dimension.parentName || null) === parentName
      )
      .map((dimension) => dimension.name);

    if (!sameSet(siblings, ordered)) {
      throw new BadRequest(ERROR_CODES.INVALID_DIMENSION);
    }
    await setEach(
      TaxonomyDimensions,
      companyId,
      ordered.map((name, index) => [{ name }, { order: positionOf(index) }])
    );
  });
}

/**
 * The values of one dimension in a new order, deactivated ones included: the
 * order of the options in the editor.
 *
 * @param {Object} params
 * @param {Object} params.user
 * @param {string} [params.groupId] the target company, super admin only
 * @param {string} params.type the dimension's name
 * @param {string[]} params.itemIds every value of the dimension
 */
async function reorderValues({ user, groupId, type, itemIds }) {
  logger.log('orderService:reorderValues');
  const companyId = resolveCompanyId(user, groupId);
  // A name, never a query: it goes into the filter below.
  if (typeof type !== 'string') {
    throw new BadRequest(ERROR_CODES.INVALID_TAXONOMY_ITEM);
  }
  await withDimensionsLocked({ companyId, names: [type] }, async () => {
    const values = await TaxonomyItems.find({ _company: companyId, type })
      .select({ _id: 1 })
      .lean();
    const ids = values.map((value) => String(value._id));
    const given = Array.isArray(itemIds) ? itemIds.map(String) : [];

    if (!sameSet(ids, given)) {
      throw new BadRequest(ERROR_CODES.INVALID_TAXONOMY_ITEM);
    }
    await setEach(
      TaxonomyItems,
      companyId,
      given.map((id, index) => [{ _id: id }, { order: positionOf(index) }])
    );
  });
}

/**
 * Token precedence as a list (ADR-0026): when values of one email carry the
 * same design token, the dimension listed last wins. The list holds active
 * dimensions; the ones left out carry no token the screen shows, and rank
 * below every one listed, so no two dimensions share a rank. The trigger
 * carries none and is refused.
 *
 * @param {Object} params
 * @param {Object} params.user
 * @param {string} [params.groupId] the target company, super admin only
 * @param {string[]} params.names the dimensions carrying tokens, the winner
 *   last
 */
async function setPrecedence({ user, groupId, names: ranked }) {
  logger.log('orderService:setPrecedence');
  const companyId = resolveCompanyId(user, groupId);
  const listed = await TaxonomyDimensions.find({ _company: companyId })
    .select({ name: 1 })
    .lean();
  const all = listed.map((dimension) => dimension.name);
  await withDimensionsLocked({ companyId, names: all }, async () => {
    const dimensions = await TaxonomyDimensions.find({
      _company: companyId,
    }).lean();
    const known = dimensions
      .filter(
        (dimension) =>
          dimension.name !== StandardDimensions.TRIGGER &&
          dimension.isActive !== false
      )
      .map((dimension) => dimension.name);
    const valid =
      names(ranked) &&
      ranked.length > 0 &&
      new Set(ranked).size === ranked.length &&
      ranked.every((name) => known.includes(name));
    if (!valid) throw new BadRequest(ERROR_CODES.INVALID_DIMENSION);
    await setEach(
      TaxonomyDimensions,
      companyId,
      dimensions.map((dimension) => [
        { name: dimension.name },
        {
          precedence: ranked.includes(dimension.name)
            ? positionOf(ranked.indexOf(dimension.name))
            : 0,
        },
      ])
    );
  });
}
