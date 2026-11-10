'use strict';

const asyncHandler = require('express-async-handler');
const createError = require('http-errors');
const ERROR_CODES = require('../../constant/error-codes.js');
const { guardKeyIn } = require('../services/guard-key.js');
const publication = require('../services/publication-batch.js');

/**
 * Several drafts published at once from the back office lists (ADR 0019,
 * #1431). The body names the selected items, `{ kind, id }`; the server finds
 * the one draft of each, and says which it leaves out and why. The key a
 * guard answered, once it ran, rides along with the publication or the
 * cancellation.
 */

const KINDS = ['skill', 'expertise'];
// What one batch publishes at most, as the lists page 200 rows at most.
const MAX_ITEMS = 200;

function itemsOf(req) {
  const { items } = req.body || {};
  if (!Array.isArray(items) || !items.length) {
    throw createError(400, ERROR_CODES.SKILLS_PUBLICATION_SELECTION_EMPTY);
  }
  if (items.length > MAX_ITEMS) {
    throw createError(400, ERROR_CODES.SKILLS_PUBLICATION_SELECTION_TOO_BIG, {
      max: MAX_ITEMS,
    });
  }
  return items.map((item) => {
    const { kind, id, updatedAt } = item || {};
    if (!KINDS.includes(kind) || typeof id !== 'string' || !id) {
      throw createError(400, ERROR_CODES.SKILLS_PUBLICATION_SELECTION_INVALID);
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
    res.json(await publication.guardMany(targets, req.user));
  }),

  // The key the guard answered rides along, never what it showed: the
  // server records what its key carries.
  publish: asyncHandler(async (req, res) => {
    const { targets, skipped } = await publication.draftsToPublish(
      itemsOf(req)
    );
    const report = await publication.publishMany(
      targets,
      { guardKey: guardKeyIn(req.body) },
      req.user
    );
    res.json({ ...report, skipped });
  }),

  cancel: asyncHandler(async (req, res) => {
    const guardKey = guardKeyIn(req.body);
    if (!guardKey) {
      throw createError(400, ERROR_CODES.SKILL_PUBLICATION_GUARD_INVALID);
    }
    const { targets } = await publication.draftsToPublish(itemsOf(req));
    res.json(await publication.cancelMany(targets, { guardKey }, req.user));
  }),
};
