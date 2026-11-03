'use strict';

const { Comments } = require('../common/models.common.js');
const { COMMENT_DECISIONS } = require('../comment/comment.schema.js');

// From the most advanced to the least (GLOSSARY.md, "Mailing status").
const MAILING_STATUSES = ['pushed-to-esp', 'scheduled', 'approved', 'draft'];

/**
 * The ids of the mailings whose latest root comment is an approval: a comment
 * posted after it, whatever it says, lifts it, as in the app
 * (`Comment.findApprovedMailingIds`).
 *
 * @param {Array<string|Object>} mailingIds
 * @returns {Promise<Set<string>>}
 */
async function approvedMailingIds(mailingIds) {
  if (mailingIds.length === 0) return new Set();
  const comments = await Comments.find({
    _mailing: { $in: mailingIds },
    _parentComment: null,
    isDeleted: { $ne: true },
  })
    .select('_mailing decision createdAt')
    .sort({ createdAt: -1 })
    .lean();
  const latest = new Map();
  comments.forEach((comment) => {
    const id = String(comment._mailing);
    if (!latest.has(id)) latest.set(id, comment.decision);
  });
  return new Set(
    [...latest]
      .filter(([, decision]) => decision === COMMENT_DECISIONS.APPROVED)
      .map(([id]) => id)
  );
}

/**
 * A mailing's status, derived from its facts and never stored (ADR 0012):
 * pushed to an ESP, else scheduled (approved and planned in the future), else
 * approved, else draft. LePatron never knows that a mailing was sent, so no
 * status says so.
 *
 * @param {Object} facts
 * @param {number} facts.espProfileCount the ESP profiles it was pushed to
 * @param {boolean} facts.approved
 * @param {Date|string|null} [facts.plannedSendDate]
 * @param {Date} [now]
 * @returns {string} one of MAILING_STATUSES
 */
function statusOf(
  { espProfileCount, approved, plannedSendDate },
  now = new Date()
) {
  if (espProfileCount > 0) return 'pushed-to-esp';
  if (!approved) return 'draft';
  if (plannedSendDate && new Date(plannedSendDate) > now) return 'scheduled';
  return 'approved';
}

module.exports = { MAILING_STATUSES, approvedMailingIds, statusOf };
