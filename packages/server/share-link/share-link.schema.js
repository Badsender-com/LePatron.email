'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema.Types;
const {
  UserModel,
  MailingModel,
  GroupModel,
} = require('../constant/model.names.js');

// Expired links stay this long, for whoever wonders why a link stopped
// working, then MongoDB removes them (TTL index below).
const KEEP_EXPIRED_SECONDS = 30 * 24 * 60 * 60;

/**
 * A public link to the preview of an email: whoever holds it sees the last
 * saved version, without an account, until it expires or is revoked.
 *
 * Only a hash of the token is stored: the link is shown once, to the person
 * who creates it, and a copy of the database gives no working link.
 */
const ShareLinkSchema = new Schema(
  {
    // SHA-256 of the token, hex.
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    _mailing: {
      type: ObjectId,
      ref: MailingModel,
      required: true,
      index: true,
    },
    // Absent for the admin, who has no company (as on mailings).
    _company: {
      type: ObjectId,
      ref: GroupModel,
    },
    _user: {
      type: ObjectId,
      ref: UserModel,
    },
    // The language of the page around the email: its creator's.
    lang: {
      type: String,
      enum: ['en', 'fr'],
      default: 'fr',
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

ShareLinkSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: KEEP_EXPIRED_SECONDS }
);

module.exports = ShareLinkSchema;
