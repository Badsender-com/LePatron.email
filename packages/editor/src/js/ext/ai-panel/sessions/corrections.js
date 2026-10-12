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
 * field's current HTML and written as one step of the editor's undo, which
 * takes it back. A correction whose text changed since the analysis is not
 * applied: it is marked `stale`. One the undo took back is `undone`, and can
 * be accepted again.
 *
 * `api.generate(route, body)` calls the corrections route; `editor` lists the
 * text fields of a block, reads and writes them, and undoes
 * (ext/ai-panel/editor-access.js).
 */

// An alternative text is a plain value, never HTML.
const optionsOf = (role) => ({ plainText: role === 'alt' });

// Which side of a correction a field's value holds now: `before` when it can
// be placed, `after` when it was, or null when the text changed otherwise.
function sideOf(value, correction) {
  if (typeof value !== 'string') return null;
  const options = optionsOf(correction.role);
  if (!placeCorrection(value, correction, options).refused) return 'before';
  const reverse = { before: correction.after, after: correction.before };
  return placeCorrection(value, reverse, options).refused ? null : 'after';
}

/**
 * The fields a target corrects, and those left out.
 * - A field: the one the user points at, sample text or not.
 * - A block: its text fields the rendering shows, alternative texts included;
 *   a hidden field is left out quietly, one still holding the template's
 *   sample text is left out and counted.
 */
function fieldsOf(editor, target) {
  const all = editor.textFieldsOf(target.blockId);
  if (target.kind === 'blockField') {
    return { fields: all.filter((field) => field.path === target.field) };
  }
  const shown = all.filter((field) => !field.hidden);
  return {
    fields: shown.filter((field) => !field.sample),
    leftOut: { sample: shown.filter((field) => field.sample).length },
  };
}

// What the corrections route accepts in one request
// (server/text-generation/text-correction.service.js).
const MAX_FIELDS = 40;
const MAX_FIELD_LENGTH = 5000;
const MAX_TOTAL_LENGTH = 50000;

// The fields of a block in requests the route accepts, in their order.
function batchesOf(fields) {
  const batches = [];
  let batch = [];
  let length = 0;
  fields.forEach((field) => {
    if (
      batch.length === MAX_FIELDS ||
      length + field.text.length > MAX_TOTAL_LENGTH
    ) {
      batches.push(batch);
      batch = [];
      length = 0;
    }
    batch.push(field);
    length += field.text.length;
  });
  if (batch.length) batches.push(batch);
  return batches;
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
    // Each correction: { id, blockId, field, role, before, after, reason,
    // status }, status one of pending, accepted, undone, ignored, stale.
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
    // No field had any text to correct: nothing was asked.
    nothingToCorrect: false,
  };
  let nextId = 1;

  async function correctBatch(blockTarget, sent) {
    const data = await api.generate(definition.route, {
      mailingId: editor.mailingId,
      target: blockTarget,
      fields: sent,
    });
    const roles = new Map(sent.map((field) => [field.path, field.role]));
    const corrections = data.corrections.map(
      ({ field, before, after, reason }) => ({
        id: nextId++,
        blockId: blockTarget.blockId,
        field,
        role: roles.get(field),
        before,
        after,
        reason,
        status: 'pending',
      })
    );
    const sides = corrections.map((correction) =>
      sideOf(editor.readField(correction.blockId, correction.field), correction)
    );
    // Already in the text: no loss, not counted.
    state.dropped +=
      (data.dropped || 0) + sides.filter((side) => side === null).length;
    state.corrections = state.corrections.concat(
      corrections.filter((_, i) => sides[i] === 'before')
    );
  }

  /** @returns {Promise<boolean>} whether anything was sent */
  async function correct(blockTarget, fields) {
    const withText = fields
      .map((field) => ({
        path: field.path,
        role: field.role,
        text: visibleText(field.html, optionsOf(field.role)),
      }))
      .filter((field) => field.text);
    const sent = withText.filter((field) => field.text.length <= MAX_FIELD_LENGTH);
    state.tooLong += withText.length - sent.length;
    for (const batch of batchesOf(sent)) {
      await correctBatch(blockTarget, batch);
    }
    return sent.length > 0;
  }

  // Write one correction in its field as it stands now: its status says how
  // it went. Two corrections of one field: the next one reads this result.
  function write(correction) {
    const current = editor.readField(correction.blockId, correction.field);
    const side = sideOf(current, correction);
    if (side !== 'before') {
      correction.status = side === 'after' ? 'accepted' : 'stale';
      return;
    }
    const { html } = placeCorrection(
      current,
      correction,
      optionsOf(correction.role)
    );
    try {
      editor.writeField(correction.blockId, correction.field, html);
    } catch (err) {
      correction.status = 'stale';
      return;
    }
    // Written as placed, or the field changed under it.
    correction.status =
      editor.readField(correction.blockId, correction.field) === html
        ? 'accepted'
        : 'stale';
  }

  const isOpen = (c) => c.status === 'pending' || c.status === 'undone';

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
    state,
    async request() {
      state.error = null;
      state.done = false;
      state.isLoading = true;
      try {
        const { fields, leftOut = null } = fieldsOf(editor, target);
        state.leftOut = leftOut;
        state.nothingToCorrect = !(await correct(target, fields));
        state.done = true;
      } catch (err) {
        state.error = errorKey(err);
      } finally {
        state.isLoading = false;
      }
    },
    // Each returns how many corrections it wrote, and how many it could not.
    accept(id) {
      const correction = find(id);
      return acceptMany(correction ? [correction] : []);
    },
    acceptAll() {
      return acceptMany(state.corrections);
    },
    // After the editor's undo or redo: an accepted correction the text no
    // longer holds is undone, one it holds again is accepted.
    refresh() {
      state.corrections.forEach((correction) => {
        if (correction.status !== 'accepted' && correction.status !== 'undone') {
          return;
        }
        const side = sideOf(
          editor.readField(correction.blockId, correction.field),
          correction
        );
        if (side === 'before') correction.status = 'undone';
        if (side === 'after') correction.status = 'accepted';
      });
    },
    undo: () => editor.undo(),
    redo: () => editor.redo(),
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
