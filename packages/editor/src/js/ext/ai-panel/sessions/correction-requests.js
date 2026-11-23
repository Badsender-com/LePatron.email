'use strict';

const { sideOf } = require('./correction-sides');

const keyOf = (blockId, path) => JSON.stringify([blockId, path]);

const sameCorrection = (a) => (b) =>
  a.blockId === b.blockId &&
  a.field === b.field &&
  a.before === b.before &&
  a.after === b.after;

/**
 * One request to the corrections route, and what the session keeps of its
 * answer (ADR 0011). Each correction is put back on the block and the field it
 * was sent from: the target's block, or across several blocks the one the
 * server names. A correction the field no longer holds, or on a field that was
 * not sent, is counted; one the text already holds is no loss. One the session
 * already lists is not listed twice: a lot sent again after a stop brings the
 * same corrections back.
 *
 * @param {{ definition: Object, api: Object, editor: Object, state: Object }} params
 * @returns {Function} (target, fields) => Promise
 */
function createSender({ definition, api, editor, state }) {
  let nextId = 1;

  function keep(target, fields, data) {
    const sent = new Map(
      fields.map((field) => [keyOf(field.blockId || target.blockId, field.path), field])
    );
    let dropped = data.dropped || 0;
    const kept = [];
    data.corrections.forEach((item) => {
      const blockId = target.kind === 'blocks' ? item.blockId : target.blockId;
      const field = sent.get(keyOf(blockId, item.field));
      if (!field) {
        dropped += 1;
        return;
      }
      const correction = {
        id: null,
        blockId,
        field: item.field,
        role: field.role,
        before: item.before,
        after: item.after,
        reason: item.reason,
        status: 'pending',
      };
      // Said by the server as it is: a correction that rewrites more than it
      // corrects.
      if (item.rewrite !== undefined) correction.rewrite = item.rewrite;
      const side = sideOf(editor.readField(blockId, item.field), correction);
      // Already in the text: no loss, not counted.
      if (side === null) dropped += 1;
      if (side !== 'before') return;
      const listed = sameCorrection(correction);
      if (state.corrections.some(listed) || kept.some(listed)) return;
      correction.id = nextId++;
      kept.push(correction);
    });
    state.dropped += dropped;
    state.corrections = state.corrections.concat(kept);
  }

  return async function send(target, fields) {
    const data = await api.generate(definition.route, {
      mailingId: editor.mailingId,
      target,
      fields,
    });
    keep(target, fields, data);
  };
}

module.exports = { createSender };
