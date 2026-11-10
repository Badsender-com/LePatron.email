'use strict';

const { McpFeedbacks, McpRetexes } = require('../common/models.common.js');
const {
  recordSecurityEvent,
} = require('../security-event/security-event.service.js');
const {
  MCP_ACCESS_ACTIONS,
  MCP_MODULE_ACTIONS,
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
 * Records who opened or closed the MCP module (ADR 0017): what the company
 * pays for, without which MCP access opens nothing.
 *
 * @param {Object} actor the request user
 * @param {string} groupId
 * @param {boolean} [change] the new value, from writeSwitches; none when the
 *   switch did not change
 * @returns {Promise<void>}
 */
async function recordMcpModuleChange(actor, groupId, change) {
  if (change === undefined) return;
  await recordSecurityEvent({
    action: change ? MCP_MODULE_ACTIONS.OPENED : MCP_MODULE_ACTIONS.CLOSED,
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
 * What a company keeps once it stops the retex. Its users' retex are erased,
 * open or closed (ADR 0012, ADR 0021); those of the consultants belong to the
 * platform company and stay. Its feedbacks forget the session summaries, and
 * their comments are cut to what they hold without it; they stay, with their
 * rating. It may run again: a second run finds nothing left to change.
 *
 * @param {string} groupId
 * @returns {Promise<void>}
 */
async function forgetRetex(groupId) {
  await McpRetexes.deleteMany({ _company: groupId, author: 'client' });
  const filter = { _company: groupId };
  await McpFeedbacks.updateMany(
    { ...filter, retex: { $ne: null } },
    { $set: { retex: null } }
  );
  await cutLongComments(filter);
}

module.exports = {
  recordMcpAccessChange,
  recordMcpModuleChange,
  recordRetexChange,
  forgetRetex,
  MAX_COMMENT_WITHOUT_RETEX,
};
