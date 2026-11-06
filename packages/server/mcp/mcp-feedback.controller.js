'use strict';

const asyncHandler = require('express-async-handler');
const { McpFeedbacks, Groups } = require('../common/models.common.js');

// A page of feedbacks: each may carry a long session summary.
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

// The page asked for, as text from the query string: anything else is the
// first page, of the default size.
function pageOf({ page, pageSize }) {
  const size = Math.min(
    Math.max(parseInt(pageSize, 10) || DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE
  );
  const number = Math.max(parseInt(page, 10) || 1, 1);
  return { page: number, pageSize: size, skip: (number - 1) * size };
}

// The feedbacks one of whose references is a kind and an id, and a version
// if asked. Strings only: a query string may carry an object.
function referringTo({ kind, id, version }) {
  if (!kind || !id) return {};
  return {
    references: {
      $elemMatch: {
        kind: String(kind),
        id: String(id),
        ...(version && { version: String(version) }),
      },
    },
  };
}

/**
 * @api {get} /mcp-feedbacks The feedbacks sent from connected applications
 * @apiPermission platform.manage
 * @apiGroup MCP
 * @apiParam (Query) {String} [kind] skill, expertise or mailing
 * @apiParam (Query) {String} [id] what the feedbacks refer to
 * @apiParam (Query) {String} [version] its version, e.g. 1.2
 * @apiParam (Query) {Number} [page] from 1
 * @apiParam (Query) {Number} [pageSize] 50 unless asked, 200 at most
 * @apiSuccess {Object[]} items the page, the latest first
 * @apiSuccess {Number} total how many feedbacks the filter finds
 * @apiSuccess {Number} page
 * @apiSuccess {Number} pageSize
 */
async function list(req, res) {
  const filter = referringTo(req.query);
  const { page, pageSize, skip } = pageOf(req.query);
  const [kept, total] = await Promise.all([
    McpFeedbacks.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    McpFeedbacks.countDocuments(filter),
  ]);

  const groupIds = [...new Set(kept.map((f) => String(f._company)))];
  const groups = await Groups.find(
    { _id: { $in: groupIds } },
    { name: 1 }
  ).lean();
  const nameOf = new Map(groups.map((g) => [String(g._id), g.name]));

  res.json({
    items: kept.map((f) => ({
      id: String(f._id),
      rating: f.rating,
      comment: f.comment,
      group: { id: String(f._company), name: nameOf.get(String(f._company)) },
      clientId: f.clientId,
      references: f.references,
      retex: f.retex || null,
      createdAt: f.createdAt,
    })),
    total,
    page,
    pageSize,
  });
}

module.exports = { list: asyncHandler(list) };
