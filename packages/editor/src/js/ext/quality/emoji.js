'use strict';

// One emoji is what a screen reader reads as one name (team decision of
// 1 October 2026): 🔥🔥 is two, 👩‍⚕️, 👍🏽, ☝🏽, 🇫🇷 or 1️⃣ is one.
// - A pictograph drawn as an emoji: emoji by default, asked for with the
//   presentation selector, or given a skin tone (☝🏽 has no selector). ©, ®
//   and ™ stay text: they are no emoji in brand copy ("Brand® Line™").
// - Its skin tone, and the pictographs a zero-width joiner adds to it (those
//   may be text by default, like the ⚕ of 👩‍⚕️). Eight joins at most: no
//   real sequence has more, and an unbounded chain is quadratic to scan.
// - A flag: two regional indicators. A keycap: a digit, # or * with U+20E3.
// A skin tone or a lone regional indicator never starts an emoji: without
// this, a regex that backtracks would read 👍🏽 or 🇫🇷 as two.
const SKIN_TONE_RANGE = '[\\u{1F3FB}-\\u{1F3FF}]';
const PRESENTED = `(?!${SKIN_TONE_RANGE}|\\p{Regional_Indicator})(?:\\p{Emoji_Presentation}|\\p{Extended_Pictographic}\\u{FE0F}|\\p{Extended_Pictographic}(?=${SKIN_TONE_RANGE}))`;
const JOINED = '\\p{Extended_Pictographic}\\u{FE0F}?';
const SKIN_TONE = `${SKIN_TONE_RANGE}?`;
const FLAG = '\\p{Regional_Indicator}{2}';
const KEYCAP = '[#*0-9]\\u{FE0F}?\\u{20E3}';
const EMOJI = `(?:${FLAG}|${KEYCAP}|${PRESENTED}${SKIN_TONE}(?:\\u{200D}${JOINED}${SKIN_TONE}){0,8})`;

// Compiled once: `match` and `replace` reset a global regex themselves.
const EMOJI_REGEX = new RegExp(EMOJI, 'gu');

const countEmojis = (text) => ((text || '').match(EMOJI_REGEX) || []).length;

module.exports = { EMOJI, EMOJI_REGEX, countEmojis };
