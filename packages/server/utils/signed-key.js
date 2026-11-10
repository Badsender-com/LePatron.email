'use strict';

/**
 * A key the server signs and reads back, so nothing is held between the two
 * requests it joins (ADR 0019): the key of a publication guard (guard-key.js)
 * and the confirmation of an assistant's two-step tool (mcp-confirmation.js).
 * Each is signed for one purpose, which no other accepts, and holds an hour
 * from the time it carries (`at`).
 */

const crypto = require('crypto');
const config = require('../node.config.js');

const KEY_LIFETIME_MS = 60 * 60 * 1000;

const sign = (purpose, payload) =>
  crypto
    .createHmac('sha256', config.sessionSecret)
    .update(`${purpose}:${payload}`)
    .digest('base64url');

/**
 * @param {string} purpose what the key is for, which no other accepts
 * @param {Object} claims what it binds, with the time it is given (`at`)
 * @returns {string}
 */
function signKey(purpose, claims) {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${payload}.${sign(purpose, payload)}`;
}

/**
 * @param {string} purpose
 * @param {string} key
 * @returns {Object|null} the claims of a key this server signed for this
 *   purpose, or null
 */
function readKey(purpose, key) {
  const [payload, signature, extra] = String(key || '').split('.');
  if (!payload || !signature || extra !== undefined) return null;
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

// A key without a time it was given has expired too.
const isExpired = (claims) => !(Date.now() - claims.at < KEY_LIFETIME_MS);

module.exports = { signKey, readKey, isExpired, KEY_LIFETIME_MS };
