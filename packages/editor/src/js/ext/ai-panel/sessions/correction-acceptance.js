'use strict';

const {
  placeCorrection,
} = require('../../../../../../shared/text-correction/place-correction');
const { optionsOf, sideOf } = require('./correction-sides');

const isOpen = (c) => c.status === 'pending' || c.status === 'undone';
const isCorrection = (c) => c.rewrite !== true;

/**
 * Accepting and ignoring the corrections of a session (ADR 0011). An accepted
 * correction is placed again in the field as it stands, and written as one
 * step of the editor's undo; one the text no longer holds is `stale`. The
 * field's HTML before and after each write is kept: the undo and the redo
 * bring those values back, which tells the correction's side for sure.
 *
 * @param {{ editor: Object, state: Object }} params
 */
function createAcceptance({ editor, state }) {
  // By correction id: { before, after }, the field's HTML around the write.
  const written = new Map();

  const sideNow = (correction) =>
    sideOf(
      editor.readField(correction.blockId, correction.field),
      correction,
      written.get(correction.id)
    );

  // Write one correction in its field as it stands now: its status says how
  // it went. Two corrections of one field: the next one reads this result.
  // The editor never throws on a write: it only leaves the field as it was.
  function write(correction) {
    const current = editor.readField(correction.blockId, correction.field);
    const side = sideOf(current, correction, written.get(correction.id));
    if (side !== 'before') {
      correction.status = side === 'after' ? 'accepted' : 'stale';
      return;
    }
    const { html } = placeCorrection(
      current,
      correction,
      optionsOf(correction.role)
    );
    editor.writeField(correction.blockId, correction.field, html);
    // Written as placed, or the field changed under it.
    if (editor.readField(correction.blockId, correction.field) === html) {
      written.set(correction.id, { before: current, after: html });
      correction.status = 'accepted';
    } else {
      correction.status = 'stale';
    }
  }

  // Accept corrections as one step of the editor's undo.
  function acceptMany(corrections) {
    const open = corrections.filter(isOpen);
    if (open.length) {
      editor.startMultiple();
      try {
        open.forEach(write);
      } finally {
        editor.stopMultiple();
      }
    }
    const accepted = open.filter((c) => c.status === 'accepted').length;
    return { accepted, stale: open.length - accepted };
  }

  const find = (id) => state.corrections.find((c) => c.id === id);

  return {
    // The corrections are analysed again: what was written of them no longer
    // tells anything.
    forget: () => written.clear(),
    methods: {
      // Each returns how many corrections it wrote, and how many it could not.
      accept(id) {
        const correction = find(id);
        return acceptMany(correction ? [correction] : []);
      },
      // A correction that rewrites more than it corrects is accepted on its
      // own, never with the others.
      acceptAll() {
        return acceptMany(state.corrections.filter(isCorrection));
      },
      acceptBlock(blockId) {
        return acceptMany(
          state.corrections.filter(
            (c) => c.blockId === blockId && isCorrection(c)
          )
        );
      },
      // After the editor's undo or redo: an accepted correction the text no
      // longer holds is undone, one it holds again is accepted.
      refresh() {
        state.corrections.forEach((correction) => {
          if (
            correction.status !== 'accepted' &&
            correction.status !== 'undone'
          ) {
            return;
          }
          const side = sideNow(correction);
          if (side === 'before') correction.status = 'undone';
          if (side === 'after') correction.status = 'accepted';
        });
      },
      ignore(id) {
        const correction = find(id);
        if (correction && correction.status === 'pending') {
          correction.status = 'ignored';
        }
      },
    },
  };
}

module.exports = { createAcceptance };
