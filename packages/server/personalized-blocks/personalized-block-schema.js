'use strict';

const { Schema } = require('mongoose');
const {
  GroupModel,
  UserModel,
  TemplateModel,
} = require('../constant/model.names.js');
const { ObjectId, Mixed } = Schema.Types;

/**
 * @apiDefine personalizedBlock
 * @apiSuccess {String} id
 * @apiSuccess {String} name Name of the block
 * @apiSuccess {String} category Category of the block
 * @apiSuccess {Mixed} content Content of the block
 * @apiSuccess {ObjectId} _group Group associated with the block
 * @apiSuccess {ObjectId} _user User who created the block
 * @apiSuccess {Date} createdAt Creation date of the block
 */

const PersonalizedBlockSchema = Schema(
  {
    name: {
      type: String,
      required: [true, 'Block name is required'],
    },
    category: {
      type: String,
    },
    content: {
      type: Mixed,
      required: [true, 'Block content is required'],
    },
    _group: {
      type: ObjectId,
      ref: GroupModel,
      required: [true, 'Group is required'],
    },
    _user: {
      type: ObjectId,
      ref: UserModel,
      required: [true, 'User is required'],
    },
    _template: {
      type: ObjectId,
      ref: TemplateModel,
      required: [true, 'Template is required'],
    },
    createdAt: {
      type: Date,
      default: Date.now,
      required: [true, 'Creation date is required'],
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

module.exports = PersonalizedBlockSchema;
