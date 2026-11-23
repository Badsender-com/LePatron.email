'use strict';

const {
  placeCorrection,
} = require('../../../../../../shared/text-correction/place-correction');

// An alternative text is a plain value, never HTML.
const optionsOf = (role) => ({ plainText: role === 'alt' });

/**
 * Which side of a correction a field's value holds now: `before` when it can
 * be placed, `after` when it was, or null when the text changed otherwise.
 *
 * `written` is the field's HTML before and after the session wrote the
 * correction: the undo and the redo bring these exact values back, and they
 * tell the side even when placing `after` back fails because `after` is also
 * elsewhere in the field (« sa → ça » in « ça marche. Et sa ? »).
 *
 * @param {string} value the field's HTML now
 * @param {Object} correction { role, before, after }
 * @param {{ before: string, after: string }} [written]
 * @returns {'before'|'after'|null}
 */
function sideOf(value, correction, written) {
  if (typeof value !== 'string') return null;
  if (written && value === written.after) return 'after';
  if (written && value === written.before) return 'before';
  const options = optionsOf(correction.role);
  if (!placeCorrection(value, correction, options).refused) return 'before';
  const reverse = { before: correction.after, after: correction.before };
  return placeCorrection(value, reverse, options).refused ? null : 'after';
}

module.exports = { optionsOf, sideOf };
