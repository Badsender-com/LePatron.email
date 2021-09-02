'use strict';

const { Schema } = require('mongoose');
const { ObjectId } = Schema.Types;
const { GroupModel } = require('../constant/model.names.js');

/**
 * @apiDefine emailGroup
 * @apiSuccess {String} id
 * @apiSuccess {String} name
 * @apiSuccess {String} emails
 * @apiSuccess {String} _company
 */

const EmailGroupSchema = Schema(
  {
    name: {
      type: String,
      required: [true, 'Email group name is required'],
    },
    emails: {
      type: String,
      required: [true, 'Email group emails list is required'],
    },
    _company: {
      type: ObjectId,
      ref: GroupModel,
      alias: 'group',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

module.exports = EmailGroupSchema;
