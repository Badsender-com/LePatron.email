'use strict';

const asyncHandler = require('express-async-handler');
const createError = require('http-errors');

const {
  followProduction,
  lastFollow,
} = require('../services/skills-follow.service.js');
const source = require('../services/skills-source-client.js');

// One follow at a time on this instance: a second click waits for nothing.
let following = false;

/**
 * GET /api/ai-skills/follow: whether this copy follows a production, its
 * origin, and the last follow (ADR 0019).
 */
const showFollow = asyncHandler(async (_req, res) => {
  const configured = source.isConfigured();
  res.json({
    configured,
    production: source.productionOrigin(),
    last: configured ? await lastFollow() : null,
  });
});

/**
 * POST /api/ai-skills/follow: follows production now, and answers the
 * report and the last follow. A follow that cannot reach production is
 * answered as one, having written nothing.
 */
const followNow = asyncHandler(async (req, res) => {
  if (!source.isConfigured()) {
    throw createError(409, 'This instance follows no production.');
  }
  if (following) throw createError(409, 'A follow is already running.');
  following = true;
  try {
    const report = await followProduction({
      fetchExport: source.fetchProductionExport,
      actor: { id: req.user.id, name: req.user.name },
    });
    res.json({ report, last: await lastFollow() });
  } finally {
    following = false;
  }
});

module.exports = { showFollow, followNow };
