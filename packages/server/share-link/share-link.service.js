'use strict';

const crypto = require('crypto');
const createError = require('http-errors');
const mongoose = require('mongoose');

const { ShareLinks, Groups, Templates } = require('../common/models.common.js');
const ERROR_CODES = require('../constant/error-codes.js');
const GROUP_STATUS = require('../group/status.js');
const logger = require('../utils/logger.js');
const { encrypt, decrypt } = require('../utils/crypto.js');

/**
 * Public preview links of an email (quality drawer, "Share a preview").
 *
 * A token is 32 random bytes, base64url (43 characters): unguessable, so the
 * link is the only credential. It is found by its SHA-256, and kept encrypted
 * so that the editors can copy it again.
 */

const { SHARE_LINK_EXPIRY } = require('../../shared/quality/limits.js');

const EXPIRY_DAYS = SHARE_LINK_EXPIRY.days;
const DEFAULT_EXPIRY_DAYS = SHARE_LINK_EXPIRY.defaultDays;
// Active links per email: enough for every reviewer, not a way to fill the
// collection. Counted before each creation: parallel requests may go a link
// or two past it, which is harmless.
const MAX_ACTIVE_LINKS = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const generateToken = () => crypto.randomBytes(32).toString('base64url');

// Without a key (or with a broken one), a link is still created: it is only
// shown once instead.
function sealToken(token) {
  try {
    return encrypt(token);
  } catch (error) {
    logger.warn('[SHARE] token not encrypted, the link will be shown once', {
      error: error.message,
    });
    return undefined;
  }
}

function openToken(tokenEncrypted) {
  if (!tokenEncrypted) return null;
  try {
    const token = decrypt(tokenEncrypted);
    return TOKEN_SHAPE.test(token) ? token : null;
  } catch (error) {
    return null;
  }
}

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

/**
 * What the editor shows of a link: never its hash or its sealed token.
 * @param {Function} [urlOf] - token → address; with it, `url` is the link to
 *   copy again (null when it cannot be opened)
 */
function toApi(link, urlOf) {
  const api = {
    id: String(link._id),
    createdAt: link.createdAt,
    expiresAt: link.expiresAt,
    createdBy: link._user && link._user.name ? link._user.name : null,
  };
  if (urlOf) {
    const token = openToken(link.tokenEncrypted);
    api.url = token ? urlOf(token) : null;
  }
  return api;
}

/**
 * Whether the emails of a company may be shared: it is active, has the email
 * builder, and has not turned the preview links off (enableShareLinks, on the
 * company form). Without a company (sharingCompanyOf found none), it may. Also
 * says whether the company writes the subject in LePatron (email metadata):
 * the public page then shows the subject and the preheader.
 * @param {ObjectId} [companyId]
 * @returns {Promise<{ allowed: boolean, metadata: boolean }>}
 */
async function companySharing(companyId) {
  if (!companyId) return { allowed: true, metadata: false };
  const group = await Groups.findById(companyId, {
    status: 1,
    enableEmailBuilder: 1,
    enableShareLinks: 1,
    emailMetadata: 1,
  }).lean();
  const allowed = Boolean(
    group &&
      group.status !== GROUP_STATUS.INACTIVE &&
      group.enableEmailBuilder !== false &&
      group.enableShareLinks !== false
  );
  // Off unless the company opted in, as GUARD_EMAIL_METADATA reads it.
  const metadata = Boolean(group && group.emailMetadata?.enabled === true);
  return { allowed, metadata };
}

const idOf = (ref) => (ref && ref._id) || ref || undefined;
const isReference = (value) =>
  typeof value === 'string' || value instanceof mongoose.Types.ObjectId;

/**
 * The company whose setting decides whether an email may be shared: its own,
 * or, for an email of the admin (no company), the company of its template,
 * the one the editor is configured from (findOneForMosaico). Every side of
 * the sharing (the editor's section, creation, the public page) asks this,
 * so that none can allow what another hides.
 * @param {Object} mailing - with `_company` and `_wireframe`, either
 *   populated or references
 * @returns {Promise<ObjectId|undefined>}
 */
async function sharingCompanyOf(mailing) {
  if (mailing._company) return idOf(mailing._company);
  const template = mailing._wireframe;
  if (!template) return undefined;
  if (!isReference(template)) return idOf(template._company);
  const stored = await Templates.findById(template, { _company: 1 }).lean();
  return (stored && stored._company) || undefined;
}

/**
 * @returns {Promise<{ link: Object, token: string }>}
 * @throws 403 SHARE_LINKS_DISABLED when the email's company may not share
 */
async function createShareLink({ mailing, user, expiresInDays }) {
  const companyId = await sharingCompanyOf(mailing);
  const sharing = await companySharing(companyId);
  if (!sharing.allowed) {
    throw new createError.Forbidden(ERROR_CODES.SHARE_LINKS_DISABLED);
  }
  const active = await ShareLinks.countDocuments(activeQuery(mailing._id));
  if (active >= MAX_ACTIVE_LINKS) {
    throw new createError.UnprocessableEntity(
      ERROR_CODES.SHARE_LINKS_LIMIT_REACHED
    );
  }
  const token = generateToken();
  const link = await ShareLinks.create({
    tokenHash: hashToken(token),
    tokenEncrypted: sealToken(token),
    _mailing: mailing._id,
    _company: companyId,
    _user: user.isAdmin ? undefined : user.id,
    lang: user.lang === 'en' ? 'en' : 'fr',
    expiresAt: new Date(Date.now() + expiresInDays * DAY_MS),
  });
  return { link, token };
}

/** @param {Function} urlOf - token → address, for the links to copy again */
async function listActiveLinks(mailingId, urlOf) {
  const links = await ShareLinks.find(activeQuery(mailingId))
    .sort({ createdAt: -1 })
    .populate('_user', 'name')
    .lean();
  return links.map((link) => toApi(link, urlOf));
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
 * Every active link of an email stops working: on a transfer, the links were
 * made for its previous owner and company.
 */
async function revokeAllForMailing(mailingId) {
  await ShareLinks.updateMany(activeQuery(mailingId), {
    revokedAt: new Date(),
  });
}

/**
 * Every active link of a company's emails stops working: the company turned
 * sharing off, often to stop a link that leaked, and turning it back on must
 * not reopen it. A link stores the company that allowed it
 * (sharingCompanyOf), and the page refuses one stored under another company
 * than the email's: these are all the links the company could open.
 */
async function revokeAllForCompany(companyId) {
  await ShareLinks.updateMany(
    { _company: companyId, revokedAt: null, expiresAt: { $gt: new Date() } },
    { revokedAt: new Date() }
  );
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
  revokeAllForMailing,
  revokeAllForCompany,
  resolveToken,
  companySharing,
  sharingCompanyOf,
  toApi,
  hashToken,
  EXPIRY_DAYS,
  MAX_ACTIVE_LINKS,
};
