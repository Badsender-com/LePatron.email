'use strict';

const { Types } = require('mongoose');
const {
  NotFound,
  BadRequest,
  Conflict,
  Forbidden,
  InternalServerError,
} = require('http-errors');

const { TaxonomyItems, Mailings } = require('../common/models.common.js');
const ERROR_CODES = require('../constant/error-codes.js');
const { TaxonomyLimits } = require('../constant/taxonomy-type.js');
const {
  isObjectId,
  validateType,
  validatePayload,
} = require('./taxonomy.validation.js');
const logger = require('../utils/logger.js');

module.exports = {
  listTaxonomyItems,
  createTaxonomyItem,
  updateTaxonomyItem,
  deleteTaxonomyItem,
  resolveCompanyId,
};

/**
 * The company every query in this service is bounded to.
 *
 * Route guards already check that a caller may reach the `:groupId` of the URL,
 * but a guard is a separate statement from the query that follows it. Resolving
 * the company here, once, means every read and write below carries the boundary
 * itself — so a missing guard on a future route cannot turn into a cross-company
 * read or write.
 *
 * A super admin may target any company, and must name it: they have no company of
 * their own to fall back on.
 *
 * @param {Object} user
 * @param {string} [requestedGroupId] company named by the request
 * @returns {ObjectId}
 */
function resolveCompanyId(user, requestedGroupId) {
  if (!user) {
    throw new Forbidden(ERROR_CODES.FORBIDDEN_RESOURCE_OR_ACTION);
  }

  const ownGroupId = user.group?.id;

  if (!user.isAdmin) {
    // Naming another company is refused rather than silently redirected to the
    // caller's own: a request that asks for something it may not have should not
    // quietly succeed on something else.
    if (requestedGroupId && String(requestedGroupId) !== String(ownGroupId)) {
      throw new Forbidden(ERROR_CODES.FORBIDDEN_RESOURCE_OR_ACTION);
    }
    if (!ownGroupId) {
      throw new BadRequest(ERROR_CODES.MISSING_GROUP_PARAM);
    }
    // Checked, not assumed: a malformed id on the session would otherwise raise a
    // BSON error, hence a 500 where a 400 belongs.
    if (!isObjectId(ownGroupId)) {
      throw new BadRequest(ERROR_CODES.INVALID_GROUP_PARAM);
    }
    return Types.ObjectId(String(ownGroupId));
  }

  // A super admin has no company of their own to fall back on, so they must name
  // the one they are acting for. Falling back on `user.group` would let a request
  // that forgot the parameter write somewhere plausible but unintended.
  if (!requestedGroupId) {
    throw new BadRequest(ERROR_CODES.MISSING_GROUP_PARAM);
  }
  if (!isObjectId(requestedGroupId)) {
    throw new BadRequest(ERROR_CODES.INVALID_GROUP_PARAM);
  }

  return Types.ObjectId(String(requestedGroupId));
}

/**
 * @param {Object} params
 * @param {Object} params.user
 * @param {string} [params.groupId] company to read, super admin only
 * @param {string} params.type taxonomy to read, eg. `emailType`
 * @param {boolean} [params.activeOnly] only items usable in a select list
 * @returns {Promise<Array>} the company's items, in display order
 */
async function listTaxonomyItems({ user, groupId, type, activeOnly = false }) {
  logger.log('taxonomyService:listTaxonomyItems');

  const companyId = resolveCompanyId(user, groupId);
  const taxonomyType = validateType(type);

  const query = { _company: companyId, type: taxonomyType };
  if (activeOnly) {
    query.isActive = true;
  }

  return TaxonomyItems.find(query).sort({ order: 1, label: 1 });
}

async function createTaxonomyItem({ user, groupId, type, payload = {} }) {
  logger.log('taxonomyService:createTaxonomyItem');

  const companyId = resolveCompanyId(user, groupId);
  const taxonomyType = validateType(type);
  const fields = validatePayload(payload, { partial: false });

  await assertLabelIsFree({
    companyId,
    type: taxonomyType,
    label: fields.label,
  });

  // Unlike the label, the cap has no index to fall back on, so concurrent
  // creations can land a handful of items past it. Accepted rather than solved
  // with a transaction: the cap exists to keep the unpaginated read and the
  // storage bounded, and 203 items bounds them exactly as well as 200. What must
  // not drift is the per-company uniqueness, and that one the index holds.
  const existingCount = await TaxonomyItems.countDocuments({
    _company: companyId,
    type: taxonomyType,
  });

  if (existingCount >= TaxonomyLimits.ITEMS_PER_COMPANY) {
    throw new Conflict(ERROR_CODES.TAXONOMY_LIMIT_REACHED);
  }

  try {
    return await TaxonomyItems.create({
      ...fields,
      _company: companyId,
      type: taxonomyType,
    });
  } catch (error) {
    // The check above is not atomic with the insert; the unique index is what
    // actually holds. Without this, two concurrent creations of the same label
    // answer a 500 carrying the raw Mongo error — collection and index names
    // included — instead of the conflict the caller can act on.
    if (error?.code === 11000) {
      throw new Conflict(ERROR_CODES.TAXONOMY_ITEM_LABEL_ALREADY_EXISTS);
    }
    throw error;
  }
}

async function updateTaxonomyItem({ user, itemId, payload = {} }) {
  logger.log('taxonomyService:updateTaxonomyItem');

  const item = await findScopedItem({ user, itemId });
  const fields = validatePayload(payload, { partial: true });

  if (fields.label !== undefined && fields.label !== item.label) {
    await assertLabelIsFree({
      companyId: item._company,
      type: item.type,
      label: fields.label,
      exceptId: item._id,
    });
  }

  Object.assign(item, fields);

  try {
    await item.save();
  } catch (error) {
    if (error?.code === 11000) {
      throw new Conflict(ERROR_CODES.TAXONOMY_ITEM_LABEL_ALREADY_EXISTS);
    }
    throw error;
  }

  return item;
}

/**
 * Delete an item, or refuse when an email still points at it.
 *
 * The count is taken on demand rather than kept on the document: a denormalised
 * counter of the `Tag` kind drifts, and drifting here either blocks a legitimate
 * delete forever or allows one that breaks existing emails.
 */
async function deleteTaxonomyItem({ user, itemId }) {
  logger.log('taxonomyService:deleteTaxonomyItem');

  const item = await findScopedItem({ user, itemId });

  // Scoped by company as well as by item: it serves the
  // `{_company, _emailType}` index, and an email can only ever reference a
  // typology of its own company — `transferToUser` clears `_emailType` when a
  // transfer moves the mailing (mailing.controller.js).
  const usageCount = await Mailings.countDocuments({
    _company: item._company,
    _emailType: item._id,
  });

  // The count and the delete are two statements: an email assigned this typology
  // in between keeps a `_emailType` pointing at nothing. Nothing dereferences it
  // — the metadata endpoint answers the raw id (mailing-metadata.controller.js)
  // — so a lost race costs an email whose picker matches no entry, not a broken
  // screen. A transaction here would mean a replica set, which this deployment
  // does not have.
  if (usageCount > 0) {
    const error = new Conflict(ERROR_CODES.TAXONOMY_ITEM_IN_USE);
    // The count is what makes the message actionable: "used by 12 emails" tells
    // the admin whether to reassign them or just deactivate the item.
    error.details = { usageCount };
    throw error;
  }

  const deleted = await TaxonomyItems.deleteOne({
    _id: item._id,
    _company: item._company,
  });

  if (deleted.deletedCount !== 1) {
    throw new InternalServerError(ERROR_CODES.FAILED_TAXONOMY_ITEM_DELETE);
  }

  return deleted;
}

/**
 * Load one item, bounded to the caller's company in the same query as the id.
 * An item of another company reads as "not found" — the caller learns nothing
 * about what exists elsewhere.
 */
async function findScopedItem({ user, itemId }) {
  if (!itemId || !isObjectId(itemId)) {
    throw new NotFound(ERROR_CODES.TAXONOMY_ITEM_NOT_FOUND);
  }

  const query = { _id: Types.ObjectId(String(itemId)) };

  // A super admin edits across companies, but everyone else is bounded here and
  // not only by the route guard.
  if (!user?.isAdmin) {
    query._company = resolveCompanyId(user);
  }

  const item = await TaxonomyItems.findOne(query);

  if (!item) {
    throw new NotFound(ERROR_CODES.TAXONOMY_ITEM_NOT_FOUND);
  }

  return item;
}

/**
 * Two companies may use the same label; one company may not use it twice for the
 * same taxonomy. The unique index enforces this, but a duplicate would surface as
 * an E11000 rather than a usable error, so it is checked here too.
 */
async function assertLabelIsFree({ companyId, type, label, exceptId }) {
  // Case-insensitive: "Newsletter" and "newsletter" in the same curated list are a
  // mistake, not two typologies. Accent differences are NOT caught — that would
  // need a stored normalised field, and it is not the collision people actually
  // make. The unique index stays as the exact-match backstop.
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const query = {
    _company: companyId,
    type,
    label: { $regex: `^${escaped}$`, $options: 'i' },
  };
  if (exceptId) {
    query._id = { $ne: exceptId };
  }

  if (await TaxonomyItems.exists(query)) {
    throw new Conflict(ERROR_CODES.TAXONOMY_ITEM_LABEL_ALREADY_EXISTS);
  }
}
