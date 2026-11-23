'use strict';

const {
  MAX_FIELDS,
  sentLength,
} = require('../../../../../../shared/text-correction/correction-limits');
const { correctInParts } = require('./correction-fields');

/**
 * Correcting the whole email (ADR 0011): its blocks in lots of consecutive
 * blocks, one request per lot, so the instruction and the expertise are sent
 * once per lot rather than once per block. A block too big for one request is
 * sent alone, in parts. A lot that fails is taken again block by block, so
 * only a block that fails for itself is reported, and the others go on.
 *
 * A failure of the feature itself (switched off, unavailable, signed out, no
 * network) stops the correction. The AI rate limit pauses it for the delay the
 * server gives, when that delay is short, then sends the refused request
 * again; a longer one stops it, rather than leaving the user waiting. The user
 * can stop it at any time: what was found is kept, and it can resume at the
 * first block not treated (`state.nextBlock`).
 */

// The text of one lot. The route takes ten times more, but a model reading
// a long request misses more mistakes: a lot holds a few blocks of an email.
const LOT_LENGTH = 6000;

// Failures of the feature, not of a block: they stop the correction.
const STOPPING_STATUSES = [401, 403, 503];
// The longest pause the correction waits through, and the one it waits when
// the server gives no delay.
const MAX_PAUSE_SECONDS = 120;
const DEFAULT_RETRY_SECONDS = 60;

// The user stopped the correction during a pause: the lot is not treated.
const interrupted = () =>
  Object.assign(new Error('Stopped during a pause'), { interrupted: true });
const isInterrupted = (err) => Boolean(err && err.interrupted);

const statusOf = (err) => err && err.response && err.response.status;

// No answer at all: a request that never reached the server, or never came
// back. Any other exception (a block that cannot be read, an unexpected
// answer) is the block's own.
const isNetworkError = (err) =>
  Boolean(err) && !err.response && Boolean(err.isAxiosError || err.request);

const isStopping = (err) =>
  isInterrupted(err) ||
  isNetworkError(err) ||
  statusOf(err) === 429 ||
  STOPPING_STATUSES.includes(statusOf(err));

const retryDelayOf = (err) =>
  (err.response.data && err.response.data.retryAfterSeconds) ||
  DEFAULT_RETRY_SECONDS;

// A request sent again after the rate limit's delay, as long as it is short.
const pausing = ({ state, send, pause, isStopped }) =>
  async function sendPausing(target, fields) {
    for (;;) {
      try {
        return await send(target, fields);
      } catch (err) {
        if (statusOf(err) !== 429) throw err;
        const delay = retryDelayOf(err);
        if (delay > MAX_PAUSE_SECONDS) throw err;
        state.pausedFor = delay;
        state.resumesAt = Date.now() + delay * 1000;
        try {
          await pause(delay * 1000);
        } finally {
          state.pausedFor = null;
          state.resumesAt = null;
        }
        if (isStopped()) throw interrupted();
      }
    }
  };

function readMember(block, readBlock) {
  try {
    return { block, ...readBlock(block) };
  } catch (err) {
    return { block, sent: [], tooLong: 0, leftOut: null, failed: true };
  }
}

// The blocks of the next lot, from `start`: as many as LOT_LENGTH holds, and
// a block over it alone.
function lotFrom(blocks, start, readBlock) {
  const members = [];
  let fields = 0;
  let length = 0;
  for (let i = start; i < blocks.length; i += 1) {
    const member = readMember(blocks[i], readBlock);
    const size = member.sent.reduce(
      (sum, field) =>
        sum + sentLength({ ...field, blockId: member.block.blockId }),
      0
    );
    const full =
      fields + member.sent.length > MAX_FIELDS || length + size > LOT_LENGTH;
    if (members.length && full) break;
    members.push(member);
    fields += member.sent.length;
    length += size;
  }
  return members;
}

async function correctLot(members, send) {
  const withText = members.filter((member) => member.sent.length);
  if (withText.length > 1) {
    try {
      await send(
        { kind: 'blocks', blocks: withText.map((member) => member.block) },
        withText.flatMap((member) =>
          member.sent.map((field) => ({
            blockId: member.block.blockId,
            ...field,
          }))
        )
      );
      return;
    } catch (err) {
      if (isStopping(err)) throw err;
    }
  }
  // Alone, or the lot failed: block by block.
  for (const member of withText) {
    try {
      ({ unchecked: member.unchecked } = await correctInParts({
        send,
        target: { kind: 'block', ...member.block },
        fields: member.sent,
        isStopping,
      }));
    } catch (err) {
      if (isStopping(err)) throw err;
      member.failed = true;
    }
  }
}

// A lot treated: what its blocks left out, and the progress.
function count(state, members) {
  members.forEach((member) => {
    state.tooLong += member.tooLong;
    state.unchecked += member.unchecked || 0;
    if (member.leftOut) state.leftOut.sample += member.leftOut.sample;
    if (member.failed) {
      state.failedBlocks = state.failedBlocks.concat(member.block.blockId);
    }
  });
  state.nextBlock += members.length;
  state.progress = { ...state.progress, done: state.nextBlock };
}

/**
 * @param {{
 *   state: Object,         the session's state (nextBlock, progress, pausedFor…)
 *   blocks: Array,         the blocks of the email, { blockId, blockType }
 *   readBlock: Function,   (block) => { sent, tooLong, leftOut }
 *   send: Function,        (target, fields) => Promise, one request
 *   pause: Function,       (ms) => Promise, which a stop ends at once
 *   isStopped: Function,   whether the user stopped the correction
 *   onText: Function,      called when a block has text to correct
 * }} params
 */
async function correctEmail({
  state,
  blocks,
  readBlock,
  send,
  pause,
  isStopped,
  onText,
}) {
  state.progress = { done: state.nextBlock, total: blocks.length };
  const sendPausing = pausing({ state, send, pause, isStopped });
  while (state.nextBlock < blocks.length && !isStopped()) {
    const members = lotFrom(blocks, state.nextBlock, readBlock);
    if (members.some((member) => member.sent.length)) onText();
    try {
      await correctLot(members, sendPausing);
    } catch (err) {
      if (isInterrupted(err)) return;
      throw err;
    }
    count(state, members);
  }
}

module.exports = { correctEmail, isStopping, LOT_LENGTH, MAX_PAUSE_SECONDS };
