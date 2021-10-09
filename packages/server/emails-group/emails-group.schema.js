'use strict';

const { Schema } = require('mongoose');
const { ObjectId } = Schema.Types;
const { GroupModel } = require('../constant/model.names.js');

/**
 * @apiDefine emailsGroup
 * @apiSuccess {String} id
 * @apiSuccess {String} name
 * @apiSuccess {String} emails
 * @apiSuccess {String} _company
 */

const EmailsGroupSchema = Schema(
  {
    name: {
      type: String,
      required: [true, 'Emails group name is required'],
    },
    emails: {
      type: String,
      required: [true, 'Emails group emails list is required'],
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

module.exports = EmailsGroupSchema;
