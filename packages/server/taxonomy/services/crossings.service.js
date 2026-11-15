'use strict';

const mongoose = require('mongoose');
const { BadRequest, Conflict } = require('http-errors');

const {
  TaxonomyDimensions,
  TaxonomyItems,
} = require('../../common/models.common.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const { resolveCompanyId } = require('./company-scope.js');
const logger = require('../../utils/logger.js');

/**
 * The crossings of a child dimension (ADR-0026): for each of its values, the
 * parent values it is offered under (an empty list: everywhere, future values
 * included) and the ones it is the default under (ADR-0024). Saved together,
 * or refused together: availability and defaults have to agree, which a save
 * value by value cannot keep on the way.
 */
module.exports = { saveCrossings };

const asObjectId = (value) => mongoose.Types.ObjectId(String(value));
const invalid = () => new BadRequest(ERROR_CODES.INVALID_TAXONOMY_ITEM);

/**
 * @param {Object} params
 * @param {Object} params.user
 * @param {string} [params.groupId] the target company, super admin only
 * @param {string} params.type the child dimension's name
 * @param {Array<{itemId: string, parentIds: string[], defaultUnder: string[]}>}
 *   params.crossings one entry per value of the dimension, deactivated ones
 *   included
 */
async function saveCrossings({ user, groupId, type, crossings }) {
  logger.log('crossingsService:saveCrossings');
  const companyId = resolveCompanyId(user, groupId);
  const dimension = await TaxonomyDimensions.findOne({
    _company: companyId,
    name: type,
  }).lean();
  if (!dimension || !dimension.parentName || !Array.isArray(crossings)) {
    throw invalid();
  }

  const [values, parentValues] = await Promise.all([
    TaxonomyItems.find({ _company: companyId, type }).select({ _id: 1 }).lean(),
    TaxonomyItems.find({ _company: companyId, type: dimension.parentName })
      .select({ _id: 1 })
      .lean(),
  ]);
  const entries = readEntries({
    crossings,
    valueIds: values.map((value) => String(value._id)),
    parentIds: parentValues.map((value) => String(value._id)),
  });
  assertDefaults(entries);

  await Promise.all(
    entries.map((entry) =>
      TaxonomyItems.updateOne(
        { _company: companyId, _id: entry.itemId },
        {
          $set: {
            _parents: entry.parentIds.map(asObjectId),
            defaultUnder: entry.defaultUnder.map(asObjectId),
          },
        }
      )
    )
  );
}

/**
 * Every value of the dimension exactly once, every parent id a value of the
 * parent dimension.
 */
function readEntries({ crossings, valueIds, parentIds }) {
  const entries = crossings.map((crossing) => ({
    itemId: String(crossing && crossing.itemId),
    parentIds: (crossing && crossing.parentIds) || [],
    defaultUnder: (crossing && crossing.defaultUnder) || [],
  }));
  const listed = entries.map((entry) => entry.itemId);
  const everyValueOnce =
    listed.length === valueIds.length &&
    new Set(listed).size === listed.length &&
    listed.every((id) => valueIds.includes(id));
  if (!everyValueOnce) throw invalid();

  entries.forEach((entry) => {
    if (!Array.isArray(entry.parentIds) || !Array.isArray(entry.defaultUnder)) {
      throw invalid();
    }
    entry.parentIds = entry.parentIds.map(String);
    entry.defaultUnder = entry.defaultUnder.map(String);
    const known = [...entry.parentIds, ...entry.defaultUnder].every((id) =>
      parentIds.includes(id)
    );
    if (!known) throw invalid();
  });
  return entries;
}

/** A default where the value is offered, and one per parent value. */
function assertDefaults(entries) {
  entries.forEach((entry) => {
    const everywhere = entry.parentIds.length === 0;
    const offered = entry.defaultUnder.every(
      (id) => everywhere || entry.parentIds.includes(id)
    );
    if (!offered) {
      throw new BadRequest(ERROR_CODES.TAXONOMY_DEFAULT_UNDER_NOT_OFFERED);
    }
  });
  const holders = new Map();
  entries.forEach((entry) =>
    entry.defaultUnder.forEach((parentId) => {
      if (holders.has(parentId)) {
        const error = new Conflict(ERROR_CODES.TAXONOMY_DEFAULT_TAKEN);
        error.details = { itemId: holders.get(parentId) };
        throw error;
      }
      holders.set(parentId, entry.itemId);
    })
  );
}
