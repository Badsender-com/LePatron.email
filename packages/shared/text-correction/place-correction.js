'use strict';

/**
 * Placing a spelling correction in the HTML of a field (ADR 0011, epic #1251).
 *
 * The model never sees the HTML: it reads the visible text of a field and
 * answers a correction, an exact excerpt `before` and its replacement `after`.
 * This module finds `before` in the text nodes of the field and replaces it
 * there only, so tags, attributes, entities it does not change and merge tags
 * stay as they were. A correction it cannot place safely is refused, with the
 * reason:
 * - `unchanged`: `after` is `before`;
 * - `invalid-text`: `after` holds a control or bidirectional character;
 * - `multiline`: the excerpt straddles two lines of the visible text;
 * - `already-applied`: no `before`, but `after` is there: the text already
 *   holds the correction (a non-breaking space the model could not see);
 * - `not-found`: no whole-word occurrence of `before`;
 * - `ambiguous`: several;
 * - `merge-tag`: the occurrence touches a merge tag, or `after` brings one;
 * - `straddles-markup`: the occurrence crosses a tag (a word half in bold).
 *
 * Shared by the server, which drops what cannot be placed in the text, and by
 * the editor, which writes an accepted correction. No DOM: it runs on both.
 */

const { NAMED_ENTITIES } = require('./html-entities.js');

const ENTITY = /&(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/gi;
const MAX_CODE_POINT = 0x10ffff;
// Tags whose boundary separates lines of text, as the reader sees them.
const BLOCK_TAG = /^(p|div|li|ul|ol|h[1-6]|tr|td|th|table|blockquote|br)$/;
// The personalization variables of the sending platforms and of Mosaico.
const MERGE_TAG = /\{\{[^}]*\}\}|%%[^%]*%%|\*\|[^|]*\|\*|\[\[[^\]]*\]\]|@\[[^\]]*\]/g;
const WORD_CHAR = /[\p{L}\p{N}]/u;
// Never text a reader sees: control characters other than a line break, and
// the bidirectional ones, which would disguise the change shown for review.
// eslint-disable-next-line no-control-regex
const INVALID_CHAR = /[\u0000-\u0009\u000b-\u001f\u007f\u202a-\u202e\u2066-\u2069]/;
// Spaces the rendering collapses into one; a non-breaking space is not one.
const COLLAPSIBLE = /^[ \t\n\r\f]$/;

function decodeEntity(raw, body) {
  if (body[0] === '#') {
    const code =
      body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
    return Number.isFinite(code) && code <= MAX_CODE_POINT
      ? String.fromCodePoint(code)
      : raw;
  }
  const named = NAMED_ENTITIES[body];
  return named === undefined ? raw : named;
}

// A text node as units: one per character or entity, with what it shows.
function unitsOf(raw) {
  const units = [];
  let last = 0;
  raw.replace(ENTITY, (match, body, offset) => {
    Array.from(raw.slice(last, offset)).forEach((char) =>
      units.push({ raw: char, text: char })
    );
    units.push({ raw: match, text: decodeEntity(match, body) });
    last = offset + match.length;
    return match;
  });
  Array.from(raw.slice(last)).forEach((char) =>
    units.push({ raw: char, text: char })
  );
  return units;
}

// The end of the tag opened at `start`: the first `>` outside a quoted value.
function tagEnd(html, start) {
  let quote = null;
  for (let i = start + 1; i < html.length; i += 1) {
    const char = html[i];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '>') {
      return i;
    }
  }
  return -1;
}

// The HTML as a sequence of tags and text nodes.
function tokenize(html) {
  const tokens = [];
  let i = 0;
  while (i < html.length) {
    if (html.startsWith('<!--', i)) {
      const end = html.indexOf('-->', i);
      const stop = end === -1 ? html.length : end + 3;
      tokens.push({ type: 'tag', raw: html.slice(i, stop), name: '' });
      i = stop;
    } else if (html[i] === '<') {
      const end = tagEnd(html, i);
      if (end === -1) {
        tokens.push({ type: 'text', units: unitsOf(html.slice(i)) });
        break;
      }
      const raw = html.slice(i, end + 1);
      const name = /^<\/?\s*([a-zA-Z0-9-]+)/.exec(raw);
      tokens.push({
        type: 'tag',
        raw,
        name: name ? name[1].toLowerCase() : '',
      });
      i = end + 1;
    } else {
      const next = html.indexOf('<', i);
      const stop = next === -1 ? html.length : next;
      tokens.push({ type: 'text', units: unitsOf(html.slice(i, stop)) });
      i = stop;
    }
  }
  return tokens;
}

// A plain text value (an alternative text): one text node, no entity.
const plainTokens = (value) => [
  {
    type: 'text',
    units: Array.from(value).map((char) => ({ raw: char, text: char })),
  },
];

// The text the tokens show, a line break at each block boundary and the
// source's runs of spaces as one, with where each text node starts in it.
function flatten(tokens) {
  let text = '';
  const segments = [];
  tokens.forEach((token, index) => {
    if (token.type === 'tag') {
      if (BLOCK_TAG.test(token.name)) text += '\n';
      return;
    }
    const start = text.length;
    token.units.forEach((unit) => {
      const collapsed =
        COLLAPSIBLE.test(unit.text) && (text === '' || /[ \n]$/.test(text));
      // eslint-disable-next-line no-param-reassign
      unit.shown = COLLAPSIBLE.test(unit.text)
        ? collapsed
          ? ''
          : ' '
        : unit.text;
      text += unit.shown;
    });
    segments.push({ index, start, end: text.length });
  });
  return { text, segments };
}

const isWordChar = (char) => Boolean(char) && WORD_CHAR.test(char);

// Whole-word occurrences of `needle` in `text`.
function occurrences(text, needle) {
  const found = [];
  let from = text.indexOf(needle);
  while (from !== -1) {
    const end = from + needle.length;
    const startsClean = !(isWordChar(needle[0]) && isWordChar(text[from - 1]));
    const endsClean = !(
      isWordChar(needle[needle.length - 1]) && isWordChar(text[end])
    );
    if (startsClean && endsClean) found.push(from);
    from = text.indexOf(needle, from + 1);
  }
  return found;
}

// The merge tags of a text, computed once per text: a field is checked for
// every correction the model sends about it.
let lastText = null;
let lastSpans = [];
function mergeTagSpans(text) {
  if (text !== lastText) {
    lastText = text;
    lastSpans = Array.from(text.matchAll(MERGE_TAG)).map((match) => [
      match.index,
      match.index + match[0].length,
    ]);
  }
  return lastSpans;
}

const mergeTagsOf = (text) => (text.match(MERGE_TAG) || []).sort().join('\n');

/**
 * Where a correction goes in a text, or why it cannot go there.
 * @param {string} text the visible text of a field
 * @param {{ before: string, after: string }} correction
 * @returns {{ index: number } | { refused: string }}
 */
function locateCorrection(text, { before, after }) {
  if (!before || before === after) return { refused: 'unchanged' };
  if (INVALID_CHAR.test(after)) return { refused: 'invalid-text' };
  if (before.includes('\n') || after.includes('\n')) {
    return { refused: 'multiline' };
  }
  if (mergeTagsOf(before) !== mergeTagsOf(after)) {
    return { refused: 'merge-tag' };
  }
  const found = occurrences(text, before);
  if (!found.length) {
    return occurrences(text, after).length
      ? { refused: 'already-applied' }
      : { refused: 'not-found' };
  }
  if (found.length > 1) return { refused: 'ambiguous' };
  const [index] = found;
  const end = index + before.length;
  const touches = mergeTagSpans(text).some(([s, e]) => s < end && e > index);
  return touches ? { refused: 'merge-tag' } : { index };
}

const encode = (text) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\u00a0/g, '&nbsp;');

// The units of a text node from `start` to `end` (offsets in what it shows),
// or null when an offset falls inside a unit.
function unitRange(units, start, end) {
  let offset = 0;
  let from = null;
  let to = null;
  units.forEach((unit, i) => {
    if (from === null && offset === start) from = i;
    offset += unit.shown.length;
    if (to === null && offset === end) to = i + 1;
  });
  if (start === end) to = from;
  return from === null || to === null ? null : { from, to };
}

/**
 * @param {string} html the field's value
 * @param {{ before: string, after: string }} correction
 * @param {{ plainText?: boolean }} [options] a plain text value (an
 *   alternative text) is written as it is, never as HTML
 * @returns {{ html: string } | { refused: string }}
 */
function placeCorrection(html, correction, { plainText = false } = {}) {
  const value = String(html == null ? '' : html);
  const tokens = plainText ? plainTokens(value) : tokenize(value);
  const { text, segments } = flatten(tokens);
  const located = locateCorrection(text, correction);
  if (located.refused) return located;
  const start = located.index;
  const end = start + correction.before.length;
  const segment = segments.find((s) => s.start <= start && end <= s.end);
  if (!segment) return { refused: 'straddles-markup' };
  const { units } = tokens[segment.index];
  const range = unitRange(units, start - segment.start, end - segment.start);
  if (!range) return { refused: 'straddles-markup' };
  const written = plainText ? correction.after : encode(correction.after);
  const replaced =
    units
      .slice(0, range.from)
      .map((u) => u.raw)
      .join('') +
    written +
    units
      .slice(range.to)
      .map((u) => u.raw)
      .join('');
  return {
    html: tokens
      .map((token, index) => {
        if (index === segment.index) return replaced;
        return token.type === 'tag'
          ? token.raw
          : token.units.map((u) => u.raw).join('');
      })
      .join(''),
  };
}

/**
 * The text a field shows: tags dropped, entities decoded, the source's runs
 * of spaces as one, a line per paragraph or line break. A non-breaking space
 * stays one.
 * @param {string} html
 * @param {{ plainText?: boolean }} [options]
 * @returns {string}
 */
function visibleText(html, { plainText = false } = {}) {
  const value = String(html || '');
  return flatten(plainText ? plainTokens(value) : tokenize(value))
    .text.replace(/ *\n[ \n]*/g, '\n')
    .replace(/^[ \n]+|[ \n]+$/g, '');
}

/**
 * Whether a refusal is no loss for the user: the correction changes nothing,
 * or the text already holds it.
 */
const isNoLoss = (result) =>
  result.refused === 'already-applied' || result.refused === 'unchanged';

module.exports = {
  placeCorrection,
  locateCorrection,
  visibleText,
  isNoLoss,
};
