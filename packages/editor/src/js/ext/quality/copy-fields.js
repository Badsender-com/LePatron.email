'use strict';

const { stripMergeTags } = require('./merge-tag-syntax');
const { EMOJI_REGEX } = require('./emoji');

// The subject and the preheader are read through ext/email-subject.js and
// ext/email-preheader.js, shared with the AI actions.

/**
 * The length of a subject or preheader as an inbox shows it: merge tags out
 * (their value is only known at send time), one emoji one character whatever
 * its code points, and accents composed (an é typed as e + ´ is one).
 */
const inboxLength = (text) =>
  Array.from(
    stripMergeTags(text)
      .normalize('NFC')
      .replace(EMOJI_REGEX, 'x')
      .replace(/\s+/g, ' ')
      .trim()
  ).length;

module.exports = { inboxLength };
