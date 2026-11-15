'use strict';

const {
  PersonalizedBlocks,
  Users,
  Templates,
} = require('../common/models.common.js');
const mongoose = require('mongoose');
const ERROR_CODES = require('../constant/error-codes.js');
const { NotFound, BadRequest } = require('http-errors');
const logger = require('../utils/logger');
const {
  hasSyntheticBlock,
  asModel,
  TEMPLATE_FLAG_PROJECTION,
} = require('../mailing/synthetic-block-guard.js');
const {
  normalizeAndGuardSyntheticContent,
} = require('../mailing/synthetic-content-pipeline.js');

module.exports = {
  getPersonalizedBlocks,
  addPersonalizedBlock,
  updatePersonalizedBlock,
  deletePersonalizedBlock,
};

/**
 * Whether the request carries an actual id. A string or an ObjectId only:
 * mongoose 5's isValidObjectId also says yes to `undefined` and to numbers,
 * which ObjectId() turns into a made-up id.
 */
const isObjectId = (id) =>
  (typeof id === 'string' || id instanceof mongoose.Types.ObjectId) &&
  mongoose.isValidObjectId(id);

/**
 * Refuses an id the request carries that is not one. `ObjectId()` would
 * otherwise throw on it — a 500 for a mistyped URL — or, given nothing at all,
 * make up a fresh id and match nothing silently.
 *
 * @param {...*} ids
 * @throws {BadRequest} INVALID_OBJECT_ID
 */
function assertObjectIds(...ids) {
  if (!ids.every(isObjectId)) {
    throw new BadRequest(ERROR_CODES.INVALID_OBJECT_ID);
  }
}

async function getPersonalizedBlocks(groupId, templateId, searchTerm = '') {
  assertObjectIds(groupId, templateId);
  try {
    // Initialize MongoDB aggregation query
    const query = [];

    // Step 1: Filter personalized blocks by group and by template
    query.push({
      $match: {
        _group: mongoose.Types.ObjectId(groupId),
        _template: mongoose.Types.ObjectId(templateId),
      },
    });

    // Step 2: Join the "Users" collection for the name of the user who created
    // each block, which the palette prints and the search reads. An
    // aggregation applies none of the schema's field options: the projection
    // is what the list returns.
    query.push({
      $lookup: {
        from: Users.collection.name,
        let: { userId: '$_user' },
        pipeline: [
          { $match: { $expr: { $eq: ['$_id', '$$userId'] } } },
          { $project: { _id: 0, name: 1 } },
        ],
        as: 'userDetails',
      },
    });

    // Step 3: Unwind the "userDetails" arrays to directly access user fields
    query.push({
      $unwind: {
        path: '$userDetails',
        preserveNullAndEmptyArrays: true, // This will keep the documents in the pipeline even if "userDetails" is empty or null
      },
    });

    // Step 4: Conditionally filter results based on the search term
    if (searchTerm) {
      query.push({
        // Search in the "name" field of users
        // Search in the "name" field of blocks
        // Search in the "category" field of blocks
        // The 'i' option makes the search case-insensitive "block" will match "Block", "BLOCK", and "bLoCk".
        $match: {
          $or: [
            { name: { $regex: searchTerm, $options: 'i' } },
            { category: { $regex: searchTerm, $options: 'i' } },
            { 'userDetails.name': { $regex: searchTerm, $options: 'i' } },
          ],
        },
      });
    }

    // Sorting: Sort the blocks by creation date in ascending order
    query.push({ $sort: { createdAt: 1 } });

    // Execute the query
    return await PersonalizedBlocks.aggregate(query);
  } catch (error) {
    logger.error('Error in getting personalized blocks:', error);
    throw error;
  }
}

/**
 * Brings a personalized block's content to what will be stored, and refuses
 * markup its template does not allow. A personalized block is shared with the
 * whole company and dropped into other people's mailings, so it goes through
 * the same pipeline as the mailing save (mailing/synthetic-content-pipeline.js):
 * sizes, a composed block's markup rebuilt from its state, the template flags,
 * the right to compose. Loads the template only when the content holds a
 * synthetic block.
 */
async function normalizeAndGuardBlockContent({
  content,
  previousContent,
  templateId,
  mayCompose,
}) {
  await normalizeAndGuardSyntheticContent({
    data: asModel(content),
    previousData: asModel(previousContent),
    loadFlags: () =>
      templateId
        ? Templates.findById(templateId).select(TEMPLATE_FLAG_PROJECTION).lean()
        : null,
    // Gated like the email save (ADR 0027): a composition put in the library
    // is inserted by others, so who may not compose may not bring one here
    // either — even while every role that may save a block may also compose.
    mayCompose,
  });
}

// What a block's author may change. Its group, template and author are set by
// the server, never by the request.
const UPDATABLE_FIELDS = ['name', 'category', 'content'];

const updatableOf = (block) =>
  UPDATABLE_FIELDS.reduce((fields, field) => {
    if (block && Object.prototype.hasOwnProperty.call(block, field)) {
      fields[field] = block[field];
    }
    return fields;
  }, {});

// A saved block's content is the block alone: the palette builds its
// `blockInformation` from the list entry each time it lists the blocks.
const withoutBlockInformation = (content) => {
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    return content;
  }
  const { blockInformation: _blockInformation, ...block } = content;
  return block;
};

// A block is read, changed or deleted through its group: the route checks the
// caller belongs to the group named in the request, and this is what ties the
// block to that same group.
const inGroup = (id, groupId) => ({
  _id: mongoose.Types.ObjectId(id),
  _group: mongoose.Types.ObjectId(groupId),
});

/**
 * @throws {NotFound} TEMPLATE_NOT_FOUND unless the template belongs to the group
 */
async function assertTemplateInGroup(templateId, groupId) {
  const template = await Templates.findOne({
    _id: mongoose.Types.ObjectId(templateId),
    _company: mongoose.Types.ObjectId(groupId),
  })
    .select({ _id: 1 })
    .lean();
  if (!template) throw new NotFound(ERROR_CODES.TEMPLATE_NOT_FOUND);
}

/**
 * @param {Object} block name, category and content
 * @param {string} groupId
 * @param {string} templateId
 * @param {string} userId
 * @param {Object} [options]
 * @param {boolean} [options.mayCompose] whether the author holds
 *   `block.compose`; anything but `true` refuses a composition
 */
async function addPersonalizedBlock(
  block,
  groupId,
  templateId,
  userId,
  { mayCompose } = {}
) {
  assertObjectIds(groupId, templateId);
  await assertTemplateInGroup(templateId, groupId);
  const content = withoutBlockInformation(block.content);
  await normalizeAndGuardBlockContent({ content, templateId, mayCompose });

  const newBlock = await PersonalizedBlocks.create({
    ...block,
    content,
    _group: mongoose.Types.ObjectId(groupId),
    _user: mongoose.Types.ObjectId(userId),
    _template: mongoose.Types.ObjectId(templateId),
    createdAt: new Date(),
  });

  return newBlock;
}

/**
 * @param {string} id
 * @param {string} groupId
 * @param {Object} updatedBlock name, category and content, any of them
 * @param {Object} [options]
 * @param {boolean} [options.mayCompose] see addPersonalizedBlock
 */
async function updatePersonalizedBlock(
  id,
  groupId,
  updatedBlock,
  { mayCompose } = {}
) {
  assertObjectIds(id, groupId);
  const changes = updatableOf(updatedBlock);
  if ('content' in changes) {
    changes.content = withoutBlockInformation(changes.content);
  }

  if (hasSyntheticBlock(changes.content)) {
    const existing = await PersonalizedBlocks.findOne(inGroup(id, groupId))
      .select({ content: 1, _template: 1 })
      .lean();
    if (!existing) {
      throw new NotFound(ERROR_CODES.PERSONALIZED_BLOCK_NOT_FOUND);
    }
    await normalizeAndGuardBlockContent({
      content: changes.content,
      previousContent: existing.content,
      templateId: existing._template,
      mayCompose,
    });
  }

  const updated = await PersonalizedBlocks.findOneAndUpdate(
    inGroup(id, groupId),
    { $set: changes },
    { new: true } // This option returns the updated document
  );

  if (!updated) {
    throw new NotFound(ERROR_CODES.PERSONALIZED_BLOCK_NOT_FOUND);
  }

  return updated;
}

async function deletePersonalizedBlock(blockId, groupId) {
  assertObjectIds(blockId, groupId);
  const deleted = await PersonalizedBlocks.deleteOne(inGroup(blockId, groupId));

  if (deleted.deletedCount === 0) {
    throw new NotFound(ERROR_CODES.PERSONALIZED_BLOCK_NOT_FOUND);
  }
  logger.log('Deleted personalized block:', blockId, 'from the group', groupId);
}
