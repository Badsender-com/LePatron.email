'use strict';

// What the quality control measures and checks on a subject and a preheader,
// in one place: the editor's copy rules (ext/quality/rules/subject.js,
// preheader.js) judge what the client wrote with it, the server screens the
// proposals of text generation with it. Both must give the same verdict on
// the same text.

const { EMOJI, EMOJI_REGEX } = require('./emoji.js');
const { stripMergeTags } = require('./merge-tag-syntax.js');

/**
 * A subject or preheader as an inbox shows it: merge tags out (their value is
 * only known at send time), accents composed (an é typed as e + ´ is one),
 * spaces collapsed.
 */
const inboxText = (text) =>
  stripMergeTags(text).normalize('NFC').replace(/\s+/g, ' ').trim();

/**
 * The length of a subject or preheader as an inbox shows it: the inbox text,
 * one emoji one character whatever its code points.
 */
const inboxLength = (text) =>
  Array.from(inboxText(text).replace(EMOJI_REGEX, 'x')).length;

// An emoji, else one code point: the characters inboxLength counts.
const INBOX_CHARACTER = new RegExp(`${EMOJI}|[\\s\\S]`, 'gu');

/**
 * The first characters of the inbox text, counted as inboxLength counts them:
 * the part a narrow inbox shows before it cuts.
 */
const inboxStart = (text, length) =>
  (inboxText(text).match(INBOX_CHARACTER) || []).slice(0, length).join('');

// Reply and forward prefixes, in the languages our clients write in, with a
// counter or not (`Re[2]:`), colon full-width or not. Gmail asks not to fake
// them. A prefix of one or two letters must end the word ("RE: offer"):
// "Re:Think" and "re:boot" are brand names.
const SHORT_PREFIX = /^\s*(re|fw|tr|aw|wg|rv|sv|vs|r)(\[\d+\])?\s*[:：](?=\s|$)/i;
const LONG_PREFIX = /^\s*(fwd|odp|antw)(\[\d+\])?\s*[:：]/i;

/**
 * The reply or forward prefix a subject fakes, trimmed, or null.
 * @returns {string|null}
 */
function fakeReplyPrefix(subject) {
  const match = SHORT_PREFIX.exec(subject) || LONG_PREFIX.exec(subject);
  return match ? match[0].trim() : null;
}

// Compared without case, spacing, merge tags, accents decomposed, nor the
// punctuation and symbols around: "« Spring sale ! »" repeats "spring sale 🔥".
const normalise = (text) =>
  stripMergeTags(text)
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, '')
    .trim();

// Words are runs of letters or digits: what is left of a merge tag is none.
const wordCount = (text) => (text.match(/[\p{L}\p{N}]+/gu) || []).length;

/**
 * The preheader repeats the subject: the same words, or the subject then more.
 * Inboxes show them side by side, so the reader would read them twice.
 */
function repeatsSubject(preheader, subject) {
  const p = normalise(preheader);
  const s = normalise(subject);
  // Two words at least: a one-word subject ("New") is only the start of many
  // preheaders.
  if (wordCount(s) < 2 || !p.startsWith(s)) return false;
  // The subject as a whole, not the start of a longer word: "Sale" is not
  // repeated by "Salesforce".
  return p.length === s.length || /^[\s\p{P}]/u.test(p.slice(s.length));
}

module.exports = {
  inboxText,
  inboxLength,
  inboxStart,
  fakeReplyPrefix,
  repeatsSubject,
};
