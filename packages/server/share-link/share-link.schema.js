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
 * The token is looked up by its hash, and kept encrypted with the platform's
 * key (utils/crypto.js) so that the email's editors can copy the link again:
 * a copy of the database without the key gives no working link.
 */
const ShareLinkSchema = new Schema(
  {
    // SHA-256 of the token, hex.
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    // AES-256 with ENCRYPTION_KEY. Absent where no key is configured: the
    // link is then shown once, when it is created.
    tokenEncrypted: {
      type: String,
    },
    _mailing: {
      type: ObjectId,
      ref: MailingModel,
      required: true,
      index: true,
    },
    // The company whose setting allowed the link (sharingCompanyOf): the
    // email's, or its template's for an email of the admin. Whether the link
    // still opens is judged on the email's current company
    // (share-page.controller.js), which a transfer can change. Absent when
    // neither has one.
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

// MongoDB keeps the first options an index was created with: changing
// KEEP_EXPIRED_SECONDS makes autoIndex fail on "already exists with different
// options" until the index is dropped by hand (db.sharelinks.dropIndex) and
// created again at the next start.
ShareLinkSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: KEEP_EXPIRED_SECONDS }
);

module.exports = ShareLinkSchema;
