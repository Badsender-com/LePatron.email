'use strict';

/**
 * A rewrite: a correction changing more than three words of its text (ADR
 * 0011). The server marks it for the panel; it is not dropped.
 *
 * Words are compared one by one, in order, their punctuation and spaces
 * aside: a correction of the punctuation or of the spaces changes no word.
 */

const MAX_WORDS_CHANGED = 3;
const WORD = /[\p{L}\p{M}\p{N}]+/gu;

const wordsOf = (text) =>
  String(text || '')
    .normalize('NFC')
    .match(WORD) || [];

// The number of words two lists have in common, in the same order (their
// longest common subsequence).
function wordsInCommon(a, b) {
  let previous = new Array(b.length + 1).fill(0);
  a.forEach((word) => {
    const current = [0];
    b.forEach((other, j) => {
      current.push(
        word === other ? previous[j] + 1 : Math.max(previous[j + 1], current[j])
      );
    });
    previous = current;
  });
  return previous[b.length];
}

// The words a correction changes: those it replaces, removes or adds.
function wordsChanged(before, after) {
  const was = wordsOf(before);
  const is = wordsOf(after);
  const kept = wordsInCommon(was, is);
  return Math.max(was.length - kept, is.length - kept);
}

/**
 * @param {string} before
 * @param {string} after
 * @returns {boolean} whether the correction changes more than three words
 */
const isRewrite = (before, after) =>
  wordsChanged(before, after) > MAX_WORDS_CHANGED;

module.exports = { isRewrite, MAX_WORDS_CHANGED };
