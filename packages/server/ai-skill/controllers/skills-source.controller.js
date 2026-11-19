'use strict';

const asyncHandler = require('express-async-handler');
const createError = require('http-errors');
const ERROR_CODES = require('../../constant/error-codes.js');

const {
  createReadToken,
  listReadTokens,
  revokeReadToken,
  useReadToken,
} = require('../services/skills-read-tokens.service.js');
const { exportForCopies } = require('../services/skills-follow.format.js');
const source = require('../services/skills-source-client.js');
const { siteOrigin } = require('../../utils/site-origin.js');

/** GET /api/ai-skills/read-tokens: production's read tokens (ADR 0019). */
const listTokens = asyncHandler(async (_req, res) => {
  res.json({ items: await listReadTokens() });
});

/**
 * POST /api/ai-skills/read-tokens: a new read token, named after the copy it
 * serves (`name`). The token is in this answer only. A copy gives none: it
 * follows production, which no one follows in its stead (409
 * SKILLS_READ_TOKEN_ON_COPY).
 */
const createToken = asyncHandler(async (req, res) => {
  if (source.isConfigured()) {
    throw createError(409, ERROR_CODES.SKILLS_READ_TOKEN_ON_COPY);
  }
  const created = await createReadToken((req.body || {}).name, req.user);
  res.set('Cache-Control', 'no-store');
  res.status(201).json(created);
});

/** DELETE /api/ai-skills/read-tokens/:tokenId: revokes a read token. */
const revokeToken = asyncHandler(async (req, res) => {
  await revokeReadToken(req.params.tokenId, req.user);
  res.status(204).end();
});

// The token of an `Authorization: Bearer` header, and nothing else: no
// query string, which logs would keep, and no session.
function bearerOf(req) {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(req.headers.authorization || '');
  return match ? match[1] : null;
}

/**
 * Lets through a call carrying a read token not revoked, as `req.readToken`.
 * The token is never logged, nor said in the refusal.
 */
const requireReadToken = asyncHandler(async (req, _res, next) => {
  const readToken = await useReadToken(bearerOf(req));
  if (!readToken) {
    throw createError(401, ERROR_CODES.SKILLS_READ_TOKEN_REQUIRED);
  }
  req.readToken = readToken;
  next();
});

/**
 * GET /api/skills-source/export: everything production holds, as a copy
 * follows it (ADR 0019).
 */
const exportSource = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(
    await exportForCopies({ origin: siteOrigin(), by: req.readToken.name })
  );
});

module.exports = {
  listTokens,
  createToken,
  revokeToken,
  requireReadToken,
  exportSource,
};
