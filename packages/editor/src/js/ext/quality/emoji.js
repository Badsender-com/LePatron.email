'use strict';

// One emoji is one pictograph, its presentation selector and skin tone, and
// the pictographs a zero-width joiner adds to it: 👩‍⚕️ or 👍🏽 is one emoji,
// read once by a screen reader; 🔥🔥 is two (team decision of 1 October 2026).
const PICTOGRAPH = '\\p{Extended_Pictographic}\\u{FE0F}?[\\u{1F3FB}-\\u{1F3FF}]?';
const EMOJI = `${PICTOGRAPH}(?:\\u{200D}${PICTOGRAPH})*`;

const countEmojis = (text) =>
  ((text || '').match(new RegExp(EMOJI, 'gu')) || []).length;

module.exports = { EMOJI, countEmojis };
