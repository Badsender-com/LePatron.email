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
// findTags filters by companyId and sorts by label; the unique index above
// has companyId in second position so it can't serve that query. This one
// covers both the filter and the sort.
TagSchema.index({ companyId: 1, label: 1 });

module.exports = TagSchema;
