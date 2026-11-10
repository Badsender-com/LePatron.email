'use strict';

const { Schema } = require('mongoose');
const { ObjectId } = Schema.Types;
const { UserModel } = require('../../constant/model.names.js');

/**
 * A change that ended or started a feature's use of an item without
 * publishing a version (ADR 0019): the scope or the category of an active
 * expertise changed, or the item archived. Nothing was replayed; the change
 * is kept on the item, with the features it reached.
 */
const UsageChangeSchema = new Schema(
  {
    change: { type: String, enum: ['identity', 'archived'], required: true },
    by: { type: ObjectId, ref: UserModel },
    at: { type: Date, default: Date.now },
    // The features, by their type, that stopped or started using it.
    lost: { type: [String], default: [] },
    gained: { type: [String], default: [] },
  },
  { _id: false }
);

module.exports = { UsageChangeSchema };
