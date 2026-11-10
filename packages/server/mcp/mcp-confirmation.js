'use strict';

// The key a two-step tool answers at its first call and takes back at the
// second (ADR 0019): signed as the publication guard's key is (signed-key.js),
// so nothing is held between the two calls, and bound to the tool that gave
// it, to the person and to an hour.

const { signKey, readKey, isExpired } = require('../utils/signed-key.js');

// What an assistant may send back: bounded, like every input of this server.
const MAX_KEY_LENGTH = 4000;

/**
 * @param {string} purpose the tool the key is for, which no other accepts
 * @param {Object} claims what the first call checked
 * @returns {string} the key, with the time it was given
 */
const keyOf = (purpose, claims) =>
  signKey(purpose, { ...claims, at: Date.now() });

module.exports = {
  keyOf,
  claimsOf: readKey,
  isExpired,
  MAX_KEY_LENGTH,
};
