'use strict';

/**
 * Placing a spelling correction in the HTML of a field (ADR 0005, epic #1251).
 *
 * The model never sees the HTML: it reads the visible text of a field and
 * answers a correction, an exact excerpt `before` and its replacement `after`.
 * This module finds `before` in the text nodes of the field and replaces it
 * there only, so tags, attributes, entities it does not change and merge tags
 * stay as they were. A correction it cannot place safely is refused, with the
 * reason:
 * - `unchanged`: `after` is `before`;
 * - `invalid-text`: `after` holds a control character, a model's slip;
 * - `not-found`: no whole-word occurrence of `before`;
 * - `ambiguous`: several;
 * - `merge-tag`: the occurrence touches a merge tag;
 * - `straddles-markup`: the occurrence crosses a tag (a word half in bold).
 *
 * Shared by the server, which drops what cannot be placed in the text, and by
 * the editor, which writes an accepted correction. No DOM: it runs on both.
 */

const NAMED_ENTITIES = {
  nbsp: '\u00a0',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  rsquo: '\u2019',
  lsquo: '\u2018',
  laquo: '\u00ab',
  raquo: '\u00bb',
  hellip: '\u2026',
  ndash: '\u2013',
  mdash: '\u2014',
  euro: '\u20ac',
  eacute: '\u00e9',
  egrave: '\u00e8',
  ecirc: '\u00ea',
  agrave: '\u00e0',
  acirc: '\u00e2',
  ccedil: '\u00e7',
  ocirc: '\u00f4',
  ucirc: '\u00fb',
  icirc: '\u00ee',
};

const ENTITY = /&(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/gi;
// Tags whose boundary separates lines of text, as the reader sees them.
const BLOCK_TAG = /^(p|div|li|ul|ol|h[1-6]|tr|td|th|table|blockquote|br)$/;
// The personalization variables of the sending platforms and of Mosaico.
const MERGE_TAG = /\{\{[^}]*\}\}|%%[^%]*%%|\*\|[^|]*\|\*|\[\[[^\]]*\]\]|@\[[^\]]*\]/g;
const WORD_CHAR = /[\p{L}\p{N}]/u;
// Control characters other than a line break: never text a reader sees.
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR = /[\u0000-\u0009\u000b-\u001f\u007f]/;

function decodeEntity(raw, body) {
  if (body[0] === '#') {
    const code =
      body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : raw;
  }
  const named = NAMED_ENTITIES[body.toLowerCase()];
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
      const end = html.indexOf('>', i);
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

// The text the tokens show, a line break at each block boundary, with where
// each text node starts in it.
function flatten(tokens) {
  let text = '';
  const segments = [];
  tokens.forEach((token, index) => {
    if (token.type === 'tag') {
      if (BLOCK_TAG.test(token.name)) text += '\n';
      return;
    }
    const shown = token.units.map((unit) => unit.text).join('');
    segments.push({
      index,
      start: text.length,
      end: text.length + shown.length,
    });
    text += shown;
  });
  return { text, segments };
}

const isWordChar = (char) => Boolean(char) && WORD_CHAR.test(char);

// Whole-word occurrences of `before` in `text`.
function occurrences(text, before) {
  const found = [];
  let from = text.indexOf(before);
  while (from !== -1) {
    const end = from + before.length;
    const startsClean = !(isWordChar(before[0]) && isWordChar(text[from - 1]));
    const endsClean = !(
      isWordChar(before[before.length - 1]) && isWordChar(text[end])
    );
    if (startsClean && endsClean) found.push(from);
    from = text.indexOf(before, from + 1);
  }
  return found;
}

function touchesMergeTag(text, start, end) {
  return Array.from(text.matchAll(MERGE_TAG)).some(
    (match) => match.index < end && match.index + match[0].length > start
  );
}

/**
 * Where a correction goes in a text, or why it cannot go there.
 * @param {string} text the visible text of a field
 * @param {{ before: string, after: string }} correction
 * @returns {{ index: number } | { refused: string }}
 */
function locateCorrection(text, { before, after }) {
  if (!before || before === after) return { refused: 'unchanged' };
  if (CONTROL_CHAR.test(after)) return { refused: 'invalid-text' };
  const found = occurrences(text, before);
  if (!found.length) return { refused: 'not-found' };
  if (found.length > 1) return { refused: 'ambiguous' };
  const [index] = found;
  if (touchesMergeTag(text, index, index + before.length)) {
    return { refused: 'merge-tag' };
  }
  return { index };
}

const encode = (text) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\u00a0/g, '&nbsp;');

// The units of a text node from `start` to `end` (offsets in what it shows),
// or null when an offset falls inside a unit.
function unitRange(units, start, end) {
  let offset = 0;
  let from = null;
  let to = null;
  units.forEach((unit, i) => {
    if (offset === start) from = i;
    offset += unit.text.length;
    if (offset === end) to = i + 1;
  });
  if (start === end) to = from;
  return from === null || to === null ? null : { from, to };
}

/**
 * @param {string} html the field's value
 * @param {{ before: string, after: string }} correction
 * @returns {{ html: string } | { refused: string }}
 */
function placeCorrection(html, correction) {
  const tokens = tokenize(html);
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
  const replaced =
    units
      .slice(0, range.from)
      .map((u) => u.raw)
      .join('') +
    encode(correction.after) +
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
 * The text a field shows: tags dropped, entities decoded, one line per
 * paragraph or line break. A non-breaking space stays one.
 * @param {string} html
 * @returns {string}
 */
function visibleText(html) {
  return flatten(tokenize(String(html || '')))
    .text.replace(/[ \t\r]*\n[ \t\r\n]*/g, '\n')
    .replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
}

module.exports = { placeCorrection, locateCorrection, visibleText };
