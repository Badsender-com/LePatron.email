'use strict';

const {
  placeCorrection,
  visibleText,
} = require('../../../../../../shared/text-correction/place-correction');
const { errorKey } = require('./errors');

/**
 * The steps of an action of the "corrections" family (ADR 0005): analyse the
 * text of a target, then accept or ignore each correction. Nothing is written
 * before the user accepts; an accepted correction is placed again in the
 * field's current HTML and written as one step of the editor's undo, so
 * Ctrl+Z takes it back. A correction whose text changed since the analysis is
 * not applied: it is marked `stale`.
 *
 * `api.generate(route, body)` calls the corrections route; `editor` lists the
 * text fields of a block and reads and writes them
 * (ext/ai-panel/editor-access.js).
 */

// The fields a target corrects: the one the user points at, sample text or not.
function fieldsOf(editor, target) {
  return editor
    .textFieldsOf(target.blockId)
    .filter((field) => field.path === target.field);
}

/**
 * @param {{ definition: Object, target: Object, api: Object, editor: Object }} params
 */
function createCorrectionsSession({ definition, target, api, editor }) {
  // Every key present from the start: the panel makes this object reactive.
  const state = {
    action: definition.id,
    target,
    isLoading: false,
    error: null,
    // Each correction: { id, blockId, field, before, after, reason, status },
    // status one of pending, accepted, ignored, stale.
    corrections: [],
    // The analysis ended: an empty list then means no mistake.
    done: false,
    // Corrections set aside: by the server, or because they cross the
    // formatting of the field (a word half in bold), which only the HTML shows.
    dropped: 0,
  };
  let nextId = 1;

  async function correct(blockTarget, fields) {
    const sent = fields
      .map((field) => ({
        path: field.path,
        role: field.role,
        text: visibleText(field.html),
      }))
      .filter((field) => field.text);
    if (!sent.length) return;
    const data = await api.generate(definition.route, {
      mailingId: editor.mailingId,
      target: blockTarget,
      fields: sent,
    });
    const placeable = data.corrections.filter(
      (correction) =>
        !placeCorrection(
          editor.readField(blockTarget.blockId, correction.field),
          correction
        ).refused
    );
    state.dropped +=
      (data.dropped || 0) + data.corrections.length - placeable.length;
    state.corrections = state.corrections.concat(
      placeable.map((correction) => ({
        id: nextId++,
        blockId: blockTarget.blockId,
        ...correction,
        status: 'pending',
      }))
    );
  }

  // Place each correction in its field as it stands now, then write them all
  // as one step of the editor's undo.
  function write(corrections) {
    const placed = [];
    corrections.forEach((correction) => {
      const current = editor.readField(correction.blockId, correction.field);
      const result = placeCorrection(current, correction);
      if (result.refused) {
        correction.status = 'stale';
        return;
      }
      placed.push({ correction, html: result.html });
      // Two corrections of one field: the next one is placed on this result.
      editor.writeField(correction.blockId, correction.field, result.html);
    });
    return placed;
  }

  function acceptMany(corrections) {
    const pending = corrections.filter((c) => c.status === 'pending');
    if (!pending.length) return;
    editor.startMultiple();
    try {
      write(pending).forEach(({ correction }) => {
        correction.status = 'accepted';
      });
    } finally {
      editor.stopMultiple();
    }
  }

  const find = (id) => state.corrections.find((c) => c.id === id);

  return {
    state,
    async request() {
      state.error = null;
      state.done = false;
      state.isLoading = true;
      try {
        await correct(target, fieldsOf(editor, target));
        state.done = true;
      } catch (err) {
        state.error = errorKey(err);
      } finally {
        state.isLoading = false;
      }
    },
    accept(id) {
      const correction = find(id);
      if (correction) acceptMany([correction]);
    },
    acceptAll() {
      acceptMany(state.corrections);
    },
    ignore(id) {
      const correction = find(id);
      if (correction && correction.status === 'pending') {
        correction.status = 'ignored';
      }
    },
    // Nothing follows a correction.
    nextAction: () => null,
  };
}

module.exports = { createCorrectionsSession };
