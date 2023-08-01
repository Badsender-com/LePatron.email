'use strict';

const { Schema } = require('mongoose');
const { GroupModel } = require('../constant/model.names.js');
const { ObjectId } = Schema.Types;

/**
 * @apiDefine personalizedVariable
 * @apiSuccess {String} id
 * @apiSuccess {String} label
 * @apiSuccess {String} variable
 * @apiSuccess {String} _group Group associated with the variable
 */

const PersonalizedVariableSchema = Schema(
  {
    label: {
      type: String,
      required: [true, 'Variable label is required'],
    },
    variable: {
      type: String,
      required: [true, 'Variable itself is required'],
    },
    _group: {
      type: ObjectId,
      ref: GroupModel,
      required: [true, 'Group is required'],
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

module.exports = PersonalizedVariableSchema;
