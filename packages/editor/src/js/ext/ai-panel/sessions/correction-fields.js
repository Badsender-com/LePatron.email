'use strict';

const {
  visibleText,
} = require('../../../../../../shared/text-correction/place-correction');
const {
  MAX_FIELDS,
  MAX_FIELD_LENGTH,
  MAX_TOTAL_LENGTH,
  sentLength,
} = require('../../../../../../shared/text-correction/correction-limits');
const { optionsOf } = require('./correction-sides');

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
    fields: shown.filter((field) => !field.atDefault),
    leftOut: { sample: shown.filter((field) => field.atDefault).length },
  };
}

// What the fields send: their visible text, those without any left out, and
// those too long to be checked left out and counted.
function textOf(fields) {
  const withText = fields
    .map((field) => ({
      path: field.path,
      role: field.role,
      text: visibleText(field.html, optionsOf(field.role)),
    }))
    .filter((field) => field.text);
  const sent = withText.filter((field) => field.text.length <= MAX_FIELD_LENGTH);
  return { sent, tooLong: withText.length - sent.length };
}

// The fields of a block in requests the route accepts, in their order.
function batchesOf(fields) {
  const batches = [];
  let batch = [];
  let length = 0;
  fields.forEach((field) => {
    if (
      batch.length === MAX_FIELDS ||
      length + sentLength(field) > MAX_TOTAL_LENGTH
    ) {
      batches.push(batch);
      batch = [];
      length = 0;
    }
    batch.push(field);
    length += sentLength(field);
  });
  if (batch.length) batches.push(batch);
  return batches;
}

/**
 * The fields of one block, in as many requests as the route needs. A request
 * that fails for itself leaves its fields unchecked and the others go on; a
 * failure of the feature (`isStopping`) stops it, and every request failing
 * fails the block. A stop leaves the requests not sent yet.
 *
 * @returns {Promise<{ unchecked: number, complete: boolean }>} how many fields
 *   a failed request left unchecked, and whether every request was sent
 */
async function correctInParts({
  send,
  target,
  fields,
  isStopping,
  isStopped = () => false,
}) {
  let unchecked = 0;
  let failure = null;
  let complete = true;
  for (const part of batchesOf(fields)) {
    if (isStopped()) {
      complete = false;
      break;
    }
    try {
      await send(target, part);
    } catch (err) {
      if (isStopping(err)) throw err;
      failure = err;
      unchecked += part.length;
    }
  }
  if (failure && unchecked === fields.length) throw failure;
  return { unchecked, complete };
}

module.exports = { fieldsOf, textOf, batchesOf, correctInParts };
