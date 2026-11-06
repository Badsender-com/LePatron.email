'use strict';

/**
 * Production's read tokens (ADR 0019): what a copy reads production's skills
 * and expertises with, and nothing else. A super admin creates one, named
 * after the copy it serves, and revokes it. The token is answered once, at
 * creation; only its hash is stored, and neither is ever listed.
 */

const crypto = require('crypto');
const createError = require('http-errors');
const { SkillsReadTokens } = require('../../common/models.common.js');
const { isObjectIdString } = require('../../utils/model.js');

// Says what the token is to whoever finds it, a secret scanner included.
const TOKEN_PREFIX = 'lpsr_';
const MAX_NAME = 100;

const hashOf = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const listed = (doc) => ({
  id: String(doc._id),
  name: doc.name,
  createdAt: doc.createdAt,
  lastUsedAt: doc.lastUsedAt || null,
});

/**
 * Creates a read token.
 *
 * @param {string} name the copy it serves
 * @param {{ id: string }} user who creates it
 * @returns {Promise<Object>} the token as listed, with the token itself:
 *   the only time it is answered
 */
async function createReadToken(name, user) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed || trimmed.length > MAX_NAME) {
    throw createError(
      400,
      `A name of 1 to ${MAX_NAME} characters is required.`
    );
  }
  const token = `${TOKEN_PREFIX}${crypto
    .randomBytes(32)
    .toString('base64url')}`;
  const doc = await SkillsReadTokens.create({
    name: trimmed,
    tokenHash: hashOf(token),
    _createdBy: user && user.id,
    createdAt: new Date(),
    lastUsedAt: null,
    revokedAt: null,
  });
  return { ...listed(doc), token };
}

/** The read tokens not revoked, the newest first. */
async function listReadTokens() {
  const docs = await SkillsReadTokens.find({ revokedAt: null })
    .sort({ createdAt: -1 })
    .lean();
  return docs.map(listed);
}

/**
 * Revokes a read token: it reads nothing from now on.
 *
 * @param {string} id
 */
async function revokeReadToken(id) {
  const { n } = isObjectIdString(id)
    ? await SkillsReadTokens.updateOne(
        { _id: id, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      )
    : { n: 0 };
  if (!n) throw createError(404, 'No such read token.');
}

/**
 * The read token a copy presents, when it is one not revoked, its use
 * recorded; null otherwise.
 *
 * @param {string} token
 * @returns {Promise<{ id: string, name: string }|null>}
 */
async function useReadToken(token) {
  if (typeof token !== 'string' || !token.startsWith(TOKEN_PREFIX)) {
    return null;
  }
  const doc = await SkillsReadTokens.findOne({
    tokenHash: hashOf(token),
    revokedAt: null,
  }).lean();
  if (!doc) return null;
  await SkillsReadTokens.updateOne(
    { _id: doc._id },
    { $set: { lastUsedAt: new Date() } }
  );
  return { id: String(doc._id), name: doc.name };
}

module.exports = {
  createReadToken,
  listReadTokens,
  revokeReadToken,
  useReadToken,
};
