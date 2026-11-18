'use strict';

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

module.exports = { fieldsOf, batchesOf, MAX_FIELD_LENGTH };
