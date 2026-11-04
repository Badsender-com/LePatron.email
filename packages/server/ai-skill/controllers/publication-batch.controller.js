'use strict';

const asyncHandler = require('express-async-handler');
const createError = require('http-errors');
const publication = require('../services/skills-publication.service.js');

/**
 * Several drafts published at once from the back office lists (ADR 0019,
 * #1431). The body names the selected items, `{ kind, id }`; the server finds
 * the one draft of each, and says which it leaves out and why. A guard, once
 * it ran, rides along with the publication or the cancellation.
 */

const KINDS = ['skill', 'expertise'];

function itemsOf(req) {
  const { items } = req.body || {};
  if (!Array.isArray(items) || !items.length) {
    throw createError(400, 'Select at least one skill or expertise');
  }
  if (items.length > 200) {
    throw createError(400, 'Select 200 items at most');
  }
  return items.map((item) => {
    const { kind, id, updatedAt } = item || {};
    if (!KINDS.includes(kind) || typeof id !== 'string' || !id) {
      throw createError(400, 'Each item needs a kind and an id');
    }
    // When the page read the draft, a string or nothing (ADR 0014).
    return { kind, id, ...(typeof updatedAt === 'string' && { updatedAt }) };
  });
}

module.exports = {
  // The drafts, those left out, and what one guard over them would replay.
  plan: asyncHandler(async (req, res) => {
    const { targets, skipped } = await publication.draftsToPublish(
      itemsOf(req)
    );
    const plan = await publication.planMany(targets);
    res.json({ targets, skipped, ...plan });
  }),

  guard: asyncHandler(async (req, res) => {
    const { targets } = await publication.draftsToPublish(itemsOf(req));
    res.json(await publication.guardMany(targets));
  }),

  publish: asyncHandler(async (req, res) => {
    const { targets, skipped } = await publication.draftsToPublish(
      itemsOf(req)
    );
    const report = await publication.publishMany(
      targets,
      { guard: (req.body || {}).guard },
      req.user
    );
    res.json({ ...report, skipped });
  }),

  cancel: asyncHandler(async (req, res) => {
    const { guard } = req.body || {};
    if (!guard || !Array.isArray(guard.cases)) {
      throw createError(400, 'The guard that was cancelled is required');
    }
    const { targets } = await publication.draftsToPublish(itemsOf(req));
    res.json(await publication.cancelMany(targets, { guard }, req.user));
  }),
};
