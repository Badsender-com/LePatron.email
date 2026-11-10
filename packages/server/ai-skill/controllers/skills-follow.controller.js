'use strict';

const asyncHandler = require('express-async-handler');
const createError = require('http-errors');
const ERROR_CODES = require('../../constant/error-codes.js');

const { followProduction } = require('../services/skills-follow.service.js');
const {
  lastFollow,
  runningFollow,
} = require('../services/skills-follow-lock.js');
const source = require('../services/skills-source-client.js');

/**
 * GET /api/ai-skills/follow: whether this instance is a copy that follows a
 * production, its origin, the follow running now (`lock`) and the last one
 * (ADR 0019).
 */
const showFollow = asyncHandler(async (_req, res) => {
  const isCopy = source.isConfigured();
  res.json({
    isCopy,
    configured: isCopy,
    production: source.productionOrigin(),
    lock: isCopy ? await runningFollow() : null,
    last: isCopy ? await lastFollow() : null,
  });
});

/**
 * POST /api/ai-skills/follow: follows production now, and answers the
 * report and the last follow. A follow that cannot reach production is
 * answered as one, having written nothing; one asked while another runs is
 * refused (409 SKILLS_FOLLOW_RUNNING).
 */
const followNow = asyncHandler(async (req, res) => {
  if (!source.isConfigured()) {
    throw createError(409, ERROR_CODES.SKILLS_NOT_A_COPY);
  }
  const report = await followProduction({
    fetchExport: source.fetchProductionExport,
    actor: { id: req.user.id, name: req.user.name },
  });
  res.json({ report, last: await lastFollow() });
});

module.exports = { showFollow, followNow };
