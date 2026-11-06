'use strict';

const { McpFeedbacks } = require('../common/models.common.js');
const {
  recordSecurityEvent,
} = require('../security-event/security-event.service.js');
const {
  MCP_ACCESS_ACTIONS,
  RETEX_ACTIONS,
} = require('../security-event/security-event.actions.js');

/**
 * Records who turned MCP access on or off, as for the two-factor
 * requirement. It opens the company's data to its members' AI assistants.
 *
 * @param {Object} actor the request user
 * @param {string} groupId
 * @param {boolean} [change] the new value, from writeSwitches (group-switch.js);
 *   none when the switch did not change
 * @returns {Promise<void>}
 */
async function recordMcpAccessChange(actor, groupId, change) {
  if (change === undefined) return;
  await recordSecurityEvent({
    action: change ? MCP_ACCESS_ACTIONS.ENABLED : MCP_ACCESS_ACTIONS.DISABLED,
    actor: actor.id,
    group: groupId,
  });
}

/**
 * Records who allowed or stopped the retex (ADR 0012): it lets the summaries
 * of the company's assistant sessions be kept for the platform company.
 *
 * @param {Object} actor the request user
 * @param {string} groupId
 * @param {boolean} [change] the new value, from writeSwitches; none when the
 *   switch did not change
 * @returns {Promise<void>}
 */
async function recordRetexChange(actor, groupId, change) {
  if (change === undefined) return;
  await recordSecurityEvent({
    action: change ? RETEX_ACTIONS.ALLOWED : RETEX_ACTIONS.DISALLOWED,
    actor: actor.id,
    group: groupId,
  });
}

// A feedback's comment without the retex: a word on LePatron, not room for a
// session summary (ADR 0012).
const MAX_COMMENT_WITHOUT_RETEX = 500;
// MongoDB counts a string's characters as code points, JavaScript as UTF-16
// units, which an emoji takes two of: a comment over 500 units has at least
// 251 code points, which the database finds; JavaScript keeps those over 500.
const MAYBE_LONGER = `^[\\s\\S]{${
  Math.ceil(MAX_COMMENT_WITHOUT_RETEX / 2) + 1
}}`;
const BATCH_SIZE = 500;

// A comment cut to what it holds without the retex, never in the middle of a
// character written as two units.
function cut(comment) {
  const kept = comment.slice(0, MAX_COMMENT_WITHOUT_RETEX);
  const last = kept.charCodeAt(kept.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? kept.slice(0, -1) : kept;
}

// The comments of a company's feedbacks cut to what they hold without the
// retex, read through a cursor and written in batches.
async function cutLongComments(filter) {
  const maybeLong = McpFeedbacks.find(
    { ...filter, comment: { $regex: MAYBE_LONGER } },
    { comment: 1 }
  )
    .lean()
    .cursor();
  let batch = [];
  const write = async () => {
    await McpFeedbacks.bulkWrite(
      batch.map(({ _id, comment }) => ({
        updateOne: {
          filter: { _id },
          update: { $set: { comment: cut(comment) } },
        },
      }))
    );
    batch = [];
  };
  for await (const feedback of maybeLong) {
    if (feedback.comment.length > MAX_COMMENT_WITHOUT_RETEX) {
      batch.push(feedback);
      if (batch.length === BATCH_SIZE) await write();
    }
  }
  if (batch.length) await write();
}

/**
 * What a company's feedbacks keep once it stops the retex (ADR 0012): the
 * session summaries are forgotten, and the comments cut to what they hold
 * without it. The feedbacks stay, with their rating. It may run again: a
 * second run finds nothing left to change.
 *
 * @param {string} groupId
 * @param {Object} [only] the filter of the feedbacks to reach among the
 *   company's, all of them unless given (one just written)
 * @returns {Promise<void>}
 */
async function forgetRetex(groupId, only = {}) {
  const filter = { ...only, _company: groupId };
  await McpFeedbacks.updateMany(
    { ...filter, retex: { $ne: null } },
    { $set: { retex: null } }
  );
  await cutLongComments(filter);
}

module.exports = {
  recordMcpAccessChange,
  recordRetexChange,
  forgetRetex,
  MAX_COMMENT_WITHOUT_RETEX,
};
