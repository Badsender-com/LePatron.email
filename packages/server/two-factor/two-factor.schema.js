'use strict';

const { Schema } = require('mongoose');

// What an account keeps to check its second factor (ADR 0008). Never sent:
// the user schema stores it with `select: false`, and reads it only where a
// code is checked. The method itself is the visible `twoFactorMethod`.
const TwoFactorSchema = Schema(
  {
    // The TOTP secret, encrypted with the application's key: the server
    // recomputes the expected code from it, so it cannot be hashed.
    secret: { type: String },
    // The time step of the last TOTP code accepted: a code is never
    // accepted twice.
    lastTimeStep: { type: Number },
    // Hashed; each one stands in for a code once, and using one replaces
    // the whole set.
    recoveryCodes: [{ _id: false, hash: { type: String, required: true } }],
    // The browsers the member chose to remember. The cookie holds the token,
    // the account only its hash.
    trustedDevices: [
      {
        _id: false,
        tokenHash: { type: String, required: true },
        expiresAt: { type: Date, required: true },
        browser: { type: String },
        os: { type: String },
      },
    ],
    // Wrong passwords since the last sign-in.
    failedPasswords: { type: Number, default: 0 },
  },
  { _id: false }
);

module.exports = TwoFactorSchema;
