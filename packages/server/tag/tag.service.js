'use strict';

const asyncHandler = require('express-async-handler');
const { NotFound, UnprocessableEntity } = require('http-errors');
const { Tags, Mailings } = require('../common/models.common.js');
const ERROR_CODES = require('../constant/error-codes.js');

module.exports = {
  listTags: asyncHandler(listTags),
  createTag: asyncHandler(createTag),
  updateTag: asyncHandler(updateTag),
  deleteTag: asyncHandler(deleteTag),
  bulkUpdateTags: asyncHandler(bulkUpdateTags),
};

async function listTags(companyId) {
  const query = { companyId };
  const tags = await Tags.find(query).lean();
  if (!tags.length) {
    throw new NotFound(ERROR_CODES.TAGS_NOT_FOUND);
  }
  return tags;
}

async function createTag({ label, companyId }) {
  if (!label || !companyId) {
    throw new UnprocessableEntity(ERROR_CODES.INVALID_TAG_DATA);
  }
  const newTag = new Tags({ label, companyId });
  await newTag.save();
  return newTag;
}

async function updateTag(tagId, updates) {
  const tag = await Tags.findById(tagId);
  if (!tag) {
    throw new NotFound(ERROR_CODES.TAG_NOT_FOUND);
  }
  Object.assign(tag, updates);
  await tag.save();
  return tag;
}

async function deleteTag(tagId) {
  const tag = await Tags.findById(tagId);
  if (!tag) {
    throw new NotFound(ERROR_CODES.TAG_NOT_FOUND);
  }
  await Mailings.updateMany({ tags: tagId }, { $pull: { tags: tagId } });
  await tag.remove();
  return { message: 'Tag deleted successfully' };
}

async function bulkUpdateTags(tagIds, updates) {
  if (!Array.isArray(tagIds) || !tagIds.length || !updates) {
    throw new UnprocessableEntity(ERROR_CODES.INVALID_BULK_UPDATE_DATA);
  }
  const updateQueries = tagIds.map((tagId) =>
    Tags.findByIdAndUpdate(tagId, updates, { new: true })
  );
  const updatedTags = await Promise.all(updateQueries);
  return updatedTags;
}
