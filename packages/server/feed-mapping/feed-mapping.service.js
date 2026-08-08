'use strict';

const mongoose = require('mongoose');
const { NotFound, Conflict, InternalServerError } = require('http-errors');

const {
  FeedMappings,
  Integrations,
  Templates,
} = require('../common/models.common.js');
const ERROR_CODES = require('../constant/error-codes.js');
const modelsUtils = require('../utils/model.js');

module.exports = {
  create,
  update,
  deleteFeedMapping,
  findById,
  findAllByGroup,
  findActiveByTemplate,
  // exported for testing
  toStorageFieldMapping,
  toApiFieldMapping,
};

// Block field paths (the keys clients map from, e.g. "imageOptions.src")
// contain dots, which MongoDB forbids in document keys. So we never store the
// mapping as an object keyed by field path — we store each column as an array
// of { blockField, feedProperty } pairs (dots live in values, which are fine),
// and convert back to the convenient object shape on the way out so the API
// contract and both consumers (admin form, editor modal) stay object-based.

// object-per-column  ->  array-of-pairs-per-column  (for storage)
function toStorageFieldMapping(columns) {
  if (!Array.isArray(columns)) return columns;
  return columns.map((column) => {
    // Already in storage (array) shape — leave as-is (idempotent).
    if (Array.isArray(column)) return column;
    if (!column || typeof column !== 'object') return [];
    return Object.keys(column).map((blockField) => ({
      blockField,
      feedProperty: column[blockField],
    }));
  });
}

// array-of-pairs-per-column  ->  object-per-column  (for API / consumers)
function toApiFieldMapping(columns) {
  if (!Array.isArray(columns)) return columns;
  return columns.map((column) => {
    // Already object shape (legacy/defensive) — pass through.
    if (!Array.isArray(column)) return column || {};
    return column.reduce((acc, pair) => {
      if (pair && pair.blockField) acc[pair.blockField] = pair.feedProperty;
      return acc;
    }, {});
  });
}

// Return a plain feed-mapping object with fieldMapping converted back to the
// object shape the API exposes. Accepts a Mongoose doc or plain object.
function toApiDto(feedMapping) {
  if (!feedMapping) return feedMapping;
  const obj = feedMapping.toObject ? feedMapping.toObject() : feedMapping;
  return { ...obj, fieldMapping: toApiFieldMapping(obj.fieldMapping) };
}

async function create({
  user,
  integrationId,
  templateId,
  blockName,
  fieldMapping,
  ctaDefaultLabel,
}) {
  await assertIntegrationInGroup({ integrationId, user });
  const template = await assertTemplateInGroup({ templateId, user });

  const created = await FeedMappings.create({
    _company: template._company,
    _integration: integrationId,
    _template: templateId,
    blockName,
    fieldMapping: toStorageFieldMapping(fieldMapping),
    ctaDefaultLabel,
  });

  return toApiDto(created);
}

async function update({ user, feedMappingId, fields }) {
  const feedMapping = await findByIdForUser({ feedMappingId, user });

  const {
    integrationId,
    templateId,
    blockName,
    fieldMapping: nextFieldMapping,
    ctaDefaultLabel,
    isActive,
  } = fields;

  if (integrationId !== undefined) {
    await assertIntegrationInGroup({ integrationId, user });
    feedMapping._integration = integrationId;
  }
  if (templateId !== undefined) {
    await assertTemplateInGroup({ templateId, user });
    feedMapping._template = templateId;
  }
  if (blockName !== undefined) feedMapping.blockName = blockName;
  if (nextFieldMapping !== undefined)
    feedMapping.fieldMapping = toStorageFieldMapping(nextFieldMapping);
  if (ctaDefaultLabel !== undefined)
    feedMapping.ctaDefaultLabel = ctaDefaultLabel;
  if (isActive !== undefined) feedMapping.isActive = isActive;

  await feedMapping.save();
  return toApiDto(feedMapping);
}

async function deleteFeedMapping({ user, feedMappingId }) {
  await findByIdForUser({ feedMappingId, user });

  const result = await FeedMappings.deleteOne({
    _id: mongoose.Types.ObjectId(feedMappingId),
  });

  if (result.deletedCount !== 1) {
    throw new InternalServerError(ERROR_CODES.FAILED_FEED_MAPPING_DELETE);
  }

  return result;
}

async function findById(feedMappingId) {
  if (!feedMappingId || !mongoose.Types.ObjectId.isValid(feedMappingId)) {
    throw new NotFound(ERROR_CODES.FEED_MAPPING_NOT_FOUND);
  }

  const feedMapping = await FeedMappings.findById(
    mongoose.Types.ObjectId(feedMappingId)
  );

  if (!feedMapping) {
    throw new NotFound(ERROR_CODES.FEED_MAPPING_NOT_FOUND);
  }

  return feedMapping;
}

async function findByIdForUser({ feedMappingId, user }) {
  const feedMapping = await findById(feedMappingId);

  if (!user.isAdmin && feedMapping._company.toString() !== user.group.id) {
    throw new NotFound(ERROR_CODES.FEED_MAPPING_NOT_FOUND);
  }

  return feedMapping;
}

async function findAllByGroup({ groupId }) {
  const items = await FeedMappings.find({
    _company: mongoose.Types.ObjectId(groupId),
  }).sort({ createdAt: -1 });

  return items.map(toApiDto);
}

// Used by the editor's content-feed panel: only active mappings, scoped to
// the user's own group, for the template currently open in the builder.
async function findActiveByTemplate({ templateId, user }) {
  const filter = modelsUtils.addGroupFilter(user, {
    _template: mongoose.Types.ObjectId(templateId),
    isActive: true,
  });

  const items = await FeedMappings.find(filter);
  return items.map(toApiDto);
}

async function assertIntegrationInGroup({ integrationId, user }) {
  if (!integrationId || !mongoose.Types.ObjectId.isValid(integrationId)) {
    throw new Conflict(ERROR_CODES.FEED_MAPPING_INVALID_INTEGRATION);
  }
  const integration = await Integrations.findById(
    mongoose.Types.ObjectId(integrationId)
  );
  if (
    !integration ||
    (!user.isAdmin && integration._company.toString() !== user.group.id)
  ) {
    throw new Conflict(ERROR_CODES.FEED_MAPPING_INVALID_INTEGRATION);
  }
}

async function assertTemplateInGroup({ templateId, user }) {
  if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
    throw new Conflict(ERROR_CODES.FEED_MAPPING_INVALID_TEMPLATE);
  }
  const template = await Templates.findById(
    mongoose.Types.ObjectId(templateId)
  );
  if (
    !template ||
    (!user.isAdmin && template._company.toString() !== user.group.id)
  ) {
    throw new Conflict(ERROR_CODES.FEED_MAPPING_INVALID_TEMPLATE);
  }
  return template;
}
