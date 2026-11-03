'use strict';

const asyncHandler = require('express-async-handler');
const { McpFeedbacks, Groups } = require('../common/models.common.js');

const LIMIT = 200;

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
 * @apiSuccess {Object[]} items the latest first, at most 200
 */
async function list(req, res) {
  const kept = await McpFeedbacks.find(referringTo(req.query))
    .sort({ createdAt: -1 })
    .limit(LIMIT)
    .lean();

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
  });
}

module.exports = { list: asyncHandler(list) };
