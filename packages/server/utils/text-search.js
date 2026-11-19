'use strict';

// Finding a piece of text in a name, whatever its case and its accents:
// "evenement" finds "Événement", and "Événement" finds "evenement". Written as
// a regular expression, so the database applies it as JavaScript does.

// The combining accents Unicode splits a letter from (NFD).
const COMBINING = new RegExp(
  `[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`,
  'g'
);
// The letters French and the other Latin languages accent.
const FOLDS = {
  a: 'aàáâãäå',
  c: 'cç',
  e: 'eèéêë',
  i: 'iìíîï',
  n: 'nñ',
  o: 'oòóôõö',
  u: 'uùúûü',
  y: 'yýÿ',
};

const bare = (text) => String(text).normalize('NFD').replace(COMBINING, '');

/**
 * The pattern matching a text anywhere, every accent of its letters allowed.
 * Its metacharacters are escaped: the text is never a pattern itself.
 *
 * @param {string} text
 * @returns {string} a regular expression's source, for the `i` flag
 */
function containingPattern(text) {
  return bare(text)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/[aceinouy]/gi, (letter) => {
      const variants = FOLDS[letter.toLowerCase()];
      return `[${variants}${variants.toUpperCase()}]`;
    });
}

/**
 * A MongoDB condition: the field holds the text, whatever its case and accents.
 *
 * @param {string} text
 * @returns {{ $regex: string, $options: string }}
 */
function containing(text) {
  return { $regex: containingPattern(text), $options: 'i' };
}

/**
 * @param {string} text
 * @returns {RegExp} testing a string the way `containing` does in MongoDB
 */
function containingRegExp(text) {
  return new RegExp(containingPattern(text), 'i');
}

module.exports = { containing, containingRegExp };
