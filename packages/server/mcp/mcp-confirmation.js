'use strict';

// The key a two-step tool answers at its first call and takes back at the
// second (ADR 0019): signed, so nothing is held between the two calls, and
// bound to the tool that gave it, to the person and to an hour.

const crypto = require('crypto');
const config = require('../node.config.js');

const KEY_LIFETIME_MS = 60 * 60 * 1000;
const MAX_KEY_LENGTH = 4000;

const sign = (purpose, payload) =>
  crypto
    .createHmac('sha256', config.sessionSecret)
    .update(`${purpose}:${payload}`)
    .digest('base64url');

/**
 * @param {string} purpose the tool the key is for, which no other accepts
 * @param {Object} claims what the first call checked
 * @returns {string} the key, with the time it was given
 */
function keyOf(purpose, claims) {
  const payload = Buffer.from(
    JSON.stringify({ ...claims, at: Date.now() })
  ).toString('base64url');
  return `${payload}.${sign(purpose, payload)}`;
}

/**
 * @param {string} purpose
 * @param {string} key
 * @returns {Object|null} the claims of a key this server signed for this
 *   purpose, or null
 */
function claimsOf(purpose, key) {
  const [payload, signature] = String(key || '').split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(purpose, payload));
  const given = Buffer.from(signature);
  if (
    expected.length !== given.length ||
    !crypto.timingSafeEqual(expected, given)
  ) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch (err) {
    return null;
  }
}

const isExpired = (claims) => Date.now() - claims.at > KEY_LIFETIME_MS;

module.exports = { keyOf, claimsOf, isExpired, MAX_KEY_LENGTH };
