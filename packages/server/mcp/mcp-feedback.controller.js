'use strict';

const asyncHandler = require('express-async-handler');
const { McpFeedbacks, Groups } = require('../common/models.common.js');

const LIMIT = 200;

// One reference matches the filter: a kind and an id, and a version if asked.
function refersTo({ kind, id, version }) {
  return (feedback) =>
    (feedback.references || []).some(
      (reference) =>
        reference.kind === kind &&
        reference.id === id &&
        (!version || reference.version === version)
    );
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
  const { kind, id, version } = req.query;
  const feedbacks = await McpFeedbacks.find({})
    .sort({ createdAt: -1 })
    .limit(kind && id ? LIMIT * 5 : LIMIT)
    .lean();
  const kept = (kind && id
    ? feedbacks.filter(refersTo({ kind, id, version }))
    : feedbacks
  ).slice(0, LIMIT);

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
