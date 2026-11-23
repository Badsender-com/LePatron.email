'use strict';

const { errorKey } = require('./errors');
const { correctEmail, isStopping } = require('./correct-email');
const { fieldsOf, textOf, correctInParts } = require('./correction-fields');
const { createSender } = require('./correction-requests');
const { createAcceptance } = require('./correction-acceptance');

/**
 * The steps of an action of the "corrections" family (ADR 0011): analyse the
 * text of a target, then accept or ignore each correction. Nothing is written
 * before the user accepts; an accepted correction is placed again in the
 * field's current HTML and written as one step of the editor's undo, which
 * takes it back. A correction whose text changed since the analysis is not
 * applied: it is marked `stale`. One the undo took back is `undone`, and can
 * be accepted again. The whole email is corrected in lots of consecutive
 * blocks (./correct-email.js), and an analysis it stopped can resume.
 *
 * `api.generate(route, body)` calls the corrections route; `editor` lists the
 * blocks and their text fields, reads and writes them, names a block and goes
 * to it, and undoes (ext/ai-panel/editor-access.js).
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// What an analysis finds, from the start: every key present from the start,
// as the panel makes the state reactive.
const blankAnalysis = () => ({
  error: null,
  // Each correction: { id, blockId, field, role, before, after, reason,
  // status, rewrite? }, status one of pending, accepted, undone, ignored,
  // stale; `rewrite` as the server says it.
  corrections: [],
  // The analysis ended: an empty list then means no mistake.
  done: false,
  // Corrections set aside: by the server, or because they cross the
  // formatting of the field (a word half in bold), which only the HTML shows.
  dropped: 0,
  // The fields of a block left out: { sample }.
  leftOut: null,
  // Fields too long to be checked, left out.
  tooLong: 0,
  // Fields of a block sent in several requests, one of which failed.
  unchecked: 0,
  // No field had any text to correct: nothing was asked.
  nothingToCorrect: false,
  // The whole email: blocks treated so far, out of all.
  progress: null,
  // The whole email: the first block not treated yet, where it resumes.
  nextBlock: 0,
  // Seconds the rate limit holds the correction, and when it resumes (ms
  // since the epoch, to count down from).
  pausedFor: null,
  resumesAt: null,
  // Blocks whose correction failed; the others went on.
  failedBlocks: [],
  // The user stopped the correction of the whole email before its end.
  stopped: false,
  // The analysis ended before its end: the whole email before its last block
  // (stopped, failed, held by the rate limit), `resume()` going on from
  // there; a field or a block stopped before all its fields were sent,
  // `resume()` starting it again.
  canResume: false,
});

/**
 * @param {{ definition: Object, target: Object, api: Object, editor: Object, wait?: Function }} params
 */
function createCorrectionsSession({
  definition,
  target,
  api,
  editor,
  wait = sleep,
}) {
  const state = {
    action: definition.id,
    target,
    isLoading: false,
    ...blankAnalysis(),
  };
  const send = createSender({ definition, api, editor, state });
  // The session was closed, or the user stopped it: nothing more is asked.
  let cancelled = false;
  // The analysis under way, and whether one already ran.
  let running = null;
  let ran = false;
  // The whole email: its blocks as the analysis listed them, which a resume
  // goes on with, and whether any had text.
  let blocks = null;
  let hadText = false;
  // A field or a block: the analysis stopped before sending all its fields.
  let targetLeft = false;
  // What a stop calls to end a pause at once.
  let interrupt = () => {};
  const acceptance = createAcceptance({ editor, state });

  function pause(ms) {
    return new Promise((resolve) => {
      interrupt = resolve;
      Promise.resolve(wait(ms)).then(resolve, resolve);
    }).then(() => {
      interrupt = () => {};
    });
  }

  async function correctTarget() {
    const { fields, leftOut = null } = fieldsOf(editor, target);
    const { sent, tooLong } = textOf(fields);
    state.leftOut = leftOut;
    state.tooLong = tooLong;
    state.nothingToCorrect = !sent.length;
    if (!sent.length) return;
    const { unchecked, complete } = await correctInParts({
      send,
      target,
      fields: sent,
      isStopping,
      isStopped: () => cancelled,
    });
    state.unchecked = unchecked;
    targetLeft = !complete;
  }

  async function correctWholeEmail() {
    if (!blocks) {
      blocks = editor.blocks();
      state.leftOut = { sample: 0 };
    }
    try {
      await correctEmail({
        state,
        blocks,
        readBlock: (block) => {
          const { fields, leftOut } = fieldsOf(editor, {
            kind: 'block',
            ...block,
          });
          return { leftOut, ...textOf(fields) };
        },
        send,
        pause,
        isStopped: () => cancelled,
        onText: () => {
          hadText = true;
        },
      });
    } finally {
      const finished = state.nextBlock >= blocks.length;
      // No block had any text: say so, as for one field.
      state.nothingToCorrect =
        finished && !hadText && !state.failedBlocks.length;
    }
  }

  async function analyse() {
    cancelled = false;
    Object.assign(state, {
      error: null,
      done: false,
      stopped: false,
      canResume: false,
      isLoading: true,
    });
    targetLeft = false;
    try {
      if (target.kind === 'email') await correctWholeEmail();
      else await correctTarget();
      state.done = true;
    } catch (err) {
      state.error = errorKey(err);
    } finally {
      state.isLoading = false;
      state.canResume =
        target.kind === 'email'
          ? Boolean(blocks) && state.nextBlock < blocks.length
          : targetLeft;
      // Stopped as its last request or lot ended: nothing was left.
      if (!state.canResume) state.stopped = false;
      ran = true;
    }
  }

  function start() {
    running = analyse().then(() => {
      running = null;
    });
    return running;
  }

  // Let the analysis under way end, without asking anything more.
  async function settle() {
    if (!running) return;
    cancelled = true;
    interrupt();
    await running;
  }

  // Analyse again from the start, forgetting what was found.
  async function restart() {
    await settle();
    Object.assign(state, blankAnalysis());
    blocks = null;
    hadText = false;
    acceptance.forget();
    return start();
  }

  // The whole email: go on from the first block not treated, keeping what was
  // found. A field or a block starts again.
  async function resume() {
    if (running && !cancelled) return running;
    if (target.kind !== 'email') return restart();
    await settle();
    if (ran && !state.canResume) return undefined;
    return start();
  }

  return {
    state,
    // The first analysis. A session that already ran keeps what it found: it
    // never lists a correction twice.
    request() {
      if (running) return running;
      if (ran) return Promise.resolve();
      return start();
    },
    restart,
    resume,
    ...acceptance.methods,
    // Stop the correction of the whole email after the lot under way, or at
    // once during a pause; what was found stays.
    stop() {
      if (!state.isLoading || cancelled) return;
      cancelled = true;
      state.stopped = true;
      interrupt();
    },
    // The panel let go of the session: nothing more is asked.
    cancel() {
      cancelled = true;
      interrupt();
    },
    // A block, as the user knows it, and going to it on the canvas.
    blockLabel: (blockId) => editor.blockLabel(blockId),
    canGoToBlock: (blockId) => editor.canGoToBlock(blockId),
    goToBlock: (blockId) => editor.goToBlock(blockId),
    undo: () => editor.undo(),
    redo: () => editor.redo(),
    // Nothing follows a correction.
    nextAction: () => null,
  };
}

module.exports = { createCorrectionsSession };
