'use strict';

const crypto = require('crypto');
const createError = require('http-errors');

const { ShareLinks } = require('../common/models.common.js');
const ERROR_CODES = require('../constant/error-codes.js');

/**
 * Public preview links of an email (quality drawer, "Share a preview").
 *
 * A token is 32 random bytes, base64url (43 characters): unguessable, so the
 * link is the only credential. Only its SHA-256 is stored.
 */

const EXPIRY_DAYS = [1, 7, 30];
const DEFAULT_EXPIRY_DAYS = 7;
// Active links per email: enough for every reviewer, not a way to fill the
// collection. Counted before each creation: parallel requests may go a link
// or two past it, which is harmless.
const MAX_ACTIVE_LINKS = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const generateToken = () => crypto.randomBytes(32).toString('base64url');

/**
 * @param {Object} body - `{ expiresInDays }`, 1, 7 or 30 (7 when absent)
 * @returns {{ expiresInDays: number }}
 * @throws 422 INVALID_SHARE_LINK on anything else
 */
function validateCreatePayload(body) {
  const payload = body || {};
  const keys = Object.keys(payload);
  const days =
    payload.expiresInDays === undefined
      ? DEFAULT_EXPIRY_DAYS
      : payload.expiresInDays;
  if (
    keys.some((key) => key !== 'expiresInDays') ||
    !EXPIRY_DAYS.includes(days)
  ) {
    throw new createError.UnprocessableEntity(ERROR_CODES.INVALID_SHARE_LINK);
  }
  return { expiresInDays: days };
}

const activeQuery = (mailingId, now = new Date()) => ({
  _mailing: mailingId,
  revokedAt: null,
  expiresAt: { $gt: now },
});

// What the editor shows of a link: never its token, which is not stored.
function toApi(link) {
  return {
    id: String(link._id),
    createdAt: link.createdAt,
    expiresAt: link.expiresAt,
    createdBy: link._user && link._user.name ? link._user.name : null,
  };
}

/**
 * @returns {Promise<{ link: Object, token: string }>} the token is only ever
 *   returned here
 */
async function createShareLink({ mailing, user, expiresInDays }) {
  const active = await ShareLinks.countDocuments(activeQuery(mailing._id));
  if (active >= MAX_ACTIVE_LINKS) {
    throw new createError.UnprocessableEntity(
      ERROR_CODES.SHARE_LINKS_LIMIT_REACHED
    );
  }
  const token = generateToken();
  const link = await ShareLinks.create({
    tokenHash: hashToken(token),
    _mailing: mailing._id,
    _company: mailing._company,
    _user: user.isAdmin ? undefined : user.id,
    lang: user.lang === 'en' ? 'en' : 'fr',
    expiresAt: new Date(Date.now() + expiresInDays * DAY_MS),
  });
  return { link, token };
}

async function listActiveLinks(mailingId) {
  const links = await ShareLinks.find(activeQuery(mailingId))
    .sort({ createdAt: -1 })
    .populate('_user', 'name')
    .lean();
  return links.map(toApi);
}

/** Revokes a link of this email; a link of another email is a 404. */
async function revokeLink(mailingId, linkId) {
  const link = await ShareLinks.findOneAndUpdate(
    { _id: linkId, _mailing: mailingId, revokedAt: null },
    { revokedAt: new Date() }
  );
  if (!link) throw new createError.NotFound(ERROR_CODES.SHARE_LINK_NOT_FOUND);
}

/**
 * The link a token opens.
 * @returns {Promise<{ state: 'active'|'expired'|'unknown', link?: Object }>}
 *   A revoked link reads as unknown: who revoked it wanted it gone.
 */
async function resolveToken(token) {
  if (typeof token !== 'string' || !TOKEN_SHAPE.test(token)) {
    return { state: 'unknown' };
  }
  const link = await ShareLinks.findOne({ tokenHash: hashToken(token) }).lean();
  if (!link || link.revokedAt) return { state: 'unknown' };
  if (new Date(link.expiresAt) <= new Date()) return { state: 'expired', link };
  return { state: 'active', link };
}

module.exports = {
  validateCreatePayload,
  createShareLink,
  listActiveLinks,
  revokeLink,
  resolveToken,
  toApi,
  hashToken,
  EXPIRY_DAYS,
  MAX_ACTIVE_LINKS,
};
