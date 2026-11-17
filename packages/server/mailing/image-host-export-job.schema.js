'use strict';

const { Schema } = require('mongoose');
const { ObjectId } = Schema.Types;
const {
  IntegrationModel,
  MailingModel,
} = require('../constant/model.names.js');

/**
 * An export to an image host, run as a job (ADR 0029): its progress, and once
 * completed the HTML its ZIP is built from. Read only by the user who started
 * it; removed an hour after its last update.
 */
const ImageHostExportJobSchema = Schema(
  {
    jobId: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    _mailing: { type: ObjectId, ref: MailingModel, required: true },
    _integration: { type: ObjectId, ref: IntegrationModel, required: true },
    status: {
      type: String,
      enum: ['hosting', 'completed', 'failed'],
      default: 'hosting',
    },
    progress: {
      done: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    // Set every 5 seconds while the images are put: a job silent for 20 is
    // read as interrupted.
    heartbeatAt: { type: Date, default: Date.now },
    result: {
      type: new Schema(
        { prefix: String, name: String, html: String },
        { _id: false }
      ),
      default: null,
    },
    error: {
      type: new Schema({ code: String, images: [String] }, { _id: false }),
      default: null,
    },
  },
  { timestamps: true }
);

ImageHostExportJobSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 3600 });

module.exports = ImageHostExportJobSchema;
