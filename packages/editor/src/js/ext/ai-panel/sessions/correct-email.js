'use strict';

/**
 * Correcting the whole email (ADR 0005): one block after the other, one request
 * each. A block that fails is reported and the others go on; a failure of the
 * feature itself (switched off, unavailable, signed out, no network) stops the
 * correction. The AI rate limit pauses it for the delay the server gives, when
 * that delay is short; a longer one stops it, rather than leaving the user
 * waiting. The user can stop it at any time: what was found is kept.
 */

// Failures that concern the feature, not a block: they stop the correction.
// No status: the network is down.
const STOPPING_STATUSES = [undefined, 401, 403, 503];
// The longest pause the correction waits through, and the one it waits when
// the server gives no delay.
const MAX_PAUSE_SECONDS = 120;
const DEFAULT_RETRY_SECONDS = 60;

const statusOf = (err) => err && err.response && err.response.status;

const retryDelayOf = (err) =>
  (err.response.data && err.response.data.retryAfterSeconds) ||
  DEFAULT_RETRY_SECONDS;

/**
 * @param {{
 *   state: Object,         the session's state (progress, pausedFor, failedBlocks…)
 *   blocks: Array,         the blocks of the email, { blockId, blockType }
 *   correctBlock: Function (blockTarget) => Promise<boolean>, whether it had text
 *   wait: Function,        (ms) => Promise
 *   isStopped: Function,   whether the user stopped the correction
 * }} params
 */
async function correctEmail({ state, blocks, correctBlock, wait, isStopped }) {
  state.progress = { done: 0, total: blocks.length };
  let anyText = false;

  // One block; retried after the rate limit's delay.
  async function correctOne(block) {
    for (;;) {
      try {
        return await correctBlock({ kind: 'block', ...block });
      } catch (err) {
        if (statusOf(err) !== 429) throw err;
        const delay = retryDelayOf(err);
        if (delay > MAX_PAUSE_SECONDS) throw err;
        state.pausedFor = delay;
        await wait(delay * 1000);
        state.pausedFor = null;
        if (isStopped()) return false;
      }
    }
  }

  for (const block of blocks) {
    if (isStopped()) break;
    try {
      anyText = (await correctOne(block)) || anyText;
    } catch (err) {
      const status = statusOf(err);
      if (STOPPING_STATUSES.includes(status) || status === 429) throw err;
      state.failedBlocks = state.failedBlocks.concat(block.blockId);
    }
    state.progress = { ...state.progress, done: state.progress.done + 1 };
  }
  // No block had any text: say so, as for one field.
  state.nothingToCorrect =
    !anyText && !state.failedBlocks.length && !isStopped();
}

module.exports = { correctEmail, MAX_PAUSE_SECONDS };
