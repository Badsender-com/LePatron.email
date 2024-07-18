'use strict';

const mongoose = require('mongoose');
const { GroupModel } = require('../constant/model.names');
const { Schema } = mongoose;
const { ObjectId } = Schema.Types;

const TagSchema = new Schema(
  {
    label: {
      type: String,
      required: true,
    },
    companyId: {
      type: ObjectId,
      ref: GroupModel,
      required: true,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

TagSchema.index({ label: 1, companyId: 1 }, { unique: true });

module.exports = TagSchema;
