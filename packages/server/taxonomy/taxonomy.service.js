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
const { TaxonomyTypeValues } = require('../constant/taxonomy-type.js');
const logger = require('../utils/logger.js');

module.exports = {
  listTaxonomyItems,
  createTaxonomyItem,
  updateTaxonomyItem,
  deleteTaxonomyItem,
  resolveCompanyId,
};

const MAX_LABEL_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_CANONICAL_TYPE_LENGTH = 60;

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
    return Types.ObjectId(String(ownGroupId));
  }

  const targetId = requestedGroupId || ownGroupId;

  if (!targetId) {
    throw new BadRequest(ERROR_CODES.MISSING_GROUP_PARAM);
  }
  if (!Types.ObjectId.isValid(targetId)) {
    throw new BadRequest(ERROR_CODES.MISSING_GROUP_PARAM);
  }

  return Types.ObjectId(String(targetId));
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

  return TaxonomyItems.create({
    ...fields,
    _company: companyId,
    type: taxonomyType,
  });
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
  await item.save();

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

  const usageCount = await Mailings.countDocuments({
    _company: item._company,
    _emailType: item._id,
  });

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
  if (!itemId || !Types.ObjectId.isValid(itemId)) {
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
  const query = { _company: companyId, type, label };
  if (exceptId) {
    query._id = { $ne: exceptId };
  }

  if (await TaxonomyItems.exists(query)) {
    throw new Conflict(ERROR_CODES.TAXONOMY_ITEM_LABEL_ALREADY_EXISTS);
  }
}

function validateType(type) {
  if (!type || !TaxonomyTypeValues.includes(type)) {
    throw new BadRequest(ERROR_CODES.INVALID_TAXONOMY_TYPE);
  }
  return type;
}

/**
 * Validate the editable fields. On a partial update only the keys present are
 * returned, so a PATCH never clears a field it did not mention.
 *
 * @param {Object} payload
 * @param {Object} options
 * @param {boolean} options.partial
 * @returns {Object} the fields to assign
 */
function validatePayload(payload, { partial }) {
  const fields = {};
  const invalid = () => new BadRequest(ERROR_CODES.INVALID_TAXONOMY_ITEM);

  const hasLabel = payload.label !== undefined;

  if (!partial && !hasLabel) {
    throw new BadRequest(ERROR_CODES.MISSING_TAXONOMY_ITEM_LABEL);
  }

  if (hasLabel) {
    if (typeof payload.label !== 'string') throw invalid();
    const label = payload.label.trim();
    if (label === '') {
      throw new BadRequest(ERROR_CODES.MISSING_TAXONOMY_ITEM_LABEL);
    }
    if (label.length > MAX_LABEL_LENGTH) throw invalid();
    fields.label = label;
  }

  if (payload.description !== undefined) {
    if (payload.description === null) {
      fields.description = undefined;
    } else {
      if (typeof payload.description !== 'string') throw invalid();
      if (payload.description.length > MAX_DESCRIPTION_LENGTH) throw invalid();
      fields.description = payload.description;
    }
  }

  if (payload.canonicalType !== undefined) {
    if (payload.canonicalType === null || payload.canonicalType === '') {
      // The mapping onto the AI skills vocabulary is optional; clearing it is a
      // legitimate choice, not an error.
      fields.canonicalType = undefined;
    } else {
      if (typeof payload.canonicalType !== 'string') throw invalid();
      const canonicalType = payload.canonicalType.trim();
      if (canonicalType.length > MAX_CANONICAL_TYPE_LENGTH) throw invalid();
      // Deliberately not checked against the canonical list: that list evolves
      // with the AI skills, which already accept a free value and fall back on
      // the raw string. See constant/email-type-canonical.js.
      fields.canonicalType = canonicalType;
    }
  }

  if (payload.isActive !== undefined) {
    if (typeof payload.isActive !== 'boolean') throw invalid();
    fields.isActive = payload.isActive;
  }

  if (payload.order !== undefined) {
    if (typeof payload.order !== 'number' || !Number.isFinite(payload.order)) {
      throw invalid();
    }
    fields.order = payload.order;
  }

  return fields;
}
