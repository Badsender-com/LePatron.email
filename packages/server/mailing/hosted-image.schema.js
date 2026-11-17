'use strict';

const { Schema } = require('mongoose');
const { ObjectId } = Schema.Types;
const {
  IntegrationModel,
  MailingModel,
} = require('../constant/model.names.js');

/**
 * A hosted image (ADR 0028): an image of an email already put on an image
 * host, recognised by the hash of its content, so that a later export of the
 * same email reuses it rather than putting it there again. Never shared
 * between two emails: each finds all of its images in its own folder.
 */
const HostedImageSchema = Schema(
  {
    _integration: {
      type: ObjectId,
      ref: IntegrationModel,
      required: true,
    },
    _mailing: {
      type: ObjectId,
      ref: MailingModel,
      required: true,
    },
    // SHA-256 of the image's bytes: a changed image is a new one.
    hash: { type: String, required: true },
    // What the host returned: its identifier for the file, and the URL the
    // exported HTML loads it from.
    fileId: { type: String, required: true },
    url: { type: String, required: true },
  },
  { timestamps: true }
);

HostedImageSchema.index(
  { _integration: 1, _mailing: 1, hash: 1 },
  { unique: true }
);

module.exports = HostedImageSchema;
