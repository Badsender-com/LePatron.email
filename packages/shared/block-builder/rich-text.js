'use strict';

// Allow-list sanitiser for the text element.
//
// Text is edited with TinyMCE, so it arrives as markup: bold, italic, links,
// line breaks. Escaping it would show the tags; passing it through would ship
// whatever a paste carried.
//
// This REBUILDS rather than cleans. A cleaner looks for what is dangerous and
// removes it, which fails the day an attacker knows a trick the list does not.
// This walks the input and emits only what it recognises: a tag that is not on
// the list is not escaped, it is dropped, and its text content is kept. Anything
// the scanner does not understand ends up as escaped text, which is inert.
//
// Deliberately not DOMPurify: it needs a DOM, and this module lives in
// packages/shared, which has to load without one — the gallery script and the
// tests run it under plain Node. And the allow-list here is six tags wide: a
// parser that small is easier to reason about — and to test — than a
// dependency configured down to the same six.
//
// LINEAR, on purpose. The input is whatever a paste or a stored state carries,
// and the generator runs on every keystroke of the preview. The tag and
// attribute regexes this replaced backtracked quadratically: a run of `<a` that
// no `>` ever closes, or one long attribute name, cost seconds per 100KB.

const {
  escapeText,
  escapeAttribute,
  isSafeUrl,
} = require('./escape-primitives.js');

// What an email text may contain. No spans, no styles, no classes: presentation
// belongs to the element's own slots, not to pasted markup.
const ALLOWED = {
  strong: { attributes: [] },
  b: { attributes: [] },
  em: { attributes: [] },
  i: { attributes: [] },
  u: { attributes: [] },
  br: { attributes: [], void: true },
  a: { attributes: ['href'] },
};

// Tags whose CONTENT must go too — dropping the tag and keeping the text would
// leak a script body or a style sheet into the output as visible text.
const DROP_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'embed']);

const GREATER_THAN = 62; // >
const DOUBLE_QUOTE = 34; // "
const SINGLE_QUOTE = 39; // '

// A tag name: a letter, then letters and digits.
const isNameStart = (code) =>
  (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
const isNameChar = (code) => isNameStart(code) || (code >= 48 && code <= 57);

// An attribute, read at a known position (`y`): a name, `=`, a value. Only ever
// tried where a name STARTS — see keepAttributes.
const ATTRIBUTE = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/y;
const ATTRIBUTE_NAME = /[a-zA-Z-]+/g;

/**
 * @param {string} name a lowercased attribute name
 * @param {string} value its raw value
 * @returns {string} the value to emit, escaped, or '' to drop the attribute
 */
function safeAttributeValue(name, value) {
  // `href` is the only attribute on the list, and it is the one that can
  // execute. A refused URL drops the attribute rather than the link, so the
  // words stay readable.
  if (name !== 'href') return escapeAttribute(value);
  return isSafeUrl(value) ? escapeAttribute(value.trim()) : '';
}

/**
 * @param {string} raw the attribute section of a tag
 * @param {Array<string>} allowed attribute names this tag may keep
 * @returns {string} the attributes to emit, already escaped
 */
function keepAttributes(raw, allowed) {
  if (allowed.length === 0) return '';

  const kept = [];
  // Tried only where a run of name characters starts. Started inside a run,
  // the attribute regex would read the same run to the same end and fail the
  // same way — once per character, which is what made a long name quadratic.
  ATTRIBUTE_NAME.lastIndex = 0;
  let name = ATTRIBUTE_NAME.exec(raw);
  while (name !== null) {
    ATTRIBUTE.lastIndex = name.index;
    const match = ATTRIBUTE.exec(raw);
    if (match) {
      const key = match[1].toLowerCase();
      const value = match[3] ?? match[4] ?? match[5] ?? '';
      const safe =
        allowed.indexOf(key) !== -1 ? safeAttributeValue(key, value) : '';
      if (safe !== '') kept.push(`${key}="${safe}"`);
      ATTRIBUTE_NAME.lastIndex = ATTRIBUTE.lastIndex;
    }
    name = ATTRIBUTE_NAME.exec(raw);
  }

  return kept.length ? ' ' + kept.join(' ') : '';
}

/**
 * Where the tag whose attributes start at each position would end.
 *
 * `ends[q]` is the index of the `>` closing a tag whose attribute section
 * starts at `q` — quoted values skipped whole, so a `>` inside one does not
 * count — or -1 when no `>` ever closes it. Computed once, right to left, so
 * finding the end of any tag is a lookup rather than a scan to the end of the
 * input from every `<`.
 *
 * @param {string} html
 * @returns {Int32Array}
 */
function tagEnds(html) {
  const ends = new Int32Array(html.length + 1);
  ends[html.length] = -1;
  // The next quote of each kind at or after the position being computed.
  let nextDouble = -1;
  let nextSingle = -1;

  for (let q = html.length - 1; q >= 0; q -= 1) {
    const code = html.charCodeAt(q);
    if (code === GREATER_THAN) {
      ends[q] = q;
    } else if (code === DOUBLE_QUOTE) {
      ends[q] = nextDouble === -1 ? -1 : ends[nextDouble + 1];
      nextDouble = q;
    } else if (code === SINGLE_QUOTE) {
      ends[q] = nextSingle === -1 ? -1 : ends[nextSingle + 1];
      nextSingle = q;
    } else {
      ends[q] = ends[q + 1];
    }
  }

  return ends;
}

/**
 * The tag opening at `start`, or null when what is there is not one.
 *
 * Reads `<`, an optional `/`, a name made of a letter then letters and digits,
 * an attribute section and its closing `>`.
 *
 * @param {string} html
 * @param {number} start the index of a `<`
 * @param {Int32Array} ends see tagEnds
 * @returns {{ end: number, tag: string, isClose: boolean, attributes: string }|null}
 */
function readTag(html, start, ends) {
  const isClose = html.charCodeAt(start + 1) === 47; // /
  const nameStart = start + (isClose ? 2 : 1);
  if (!isNameStart(html.charCodeAt(nameStart))) return null;

  let nameEnd = nameStart + 1;
  while (nameEnd < html.length && isNameChar(html.charCodeAt(nameEnd))) {
    nameEnd += 1;
  }

  const close = ends[nameEnd];
  if (close === -1) return null;

  return {
    end: close + 1,
    tag: html.slice(nameStart, nameEnd).toLowerCase(),
    isClose,
    attributes: html.slice(nameEnd, close),
  };
}

/**
 * What one recognised tag contributes to the output, given the tags still open.
 *
 * @param {{ tag: string, isClose: boolean, attributes: string }} token
 * @param {Array<string>} open the allowed tags emitted and not yet closed
 * @returns {string}
 */
function emitTag({ tag, isClose, attributes }, open) {
  if (!Object.prototype.hasOwnProperty.call(ALLOWED, tag)) {
    // Anything else: dropped, content kept.
    return '';
  }

  const rule = ALLOWED[tag];
  if (rule.void) return `<${tag} />`;

  if (isClose) {
    // Only close what was opened, so a stray `</strong>` cannot close a tag
    // this function emitted around it.
    if (open.length && open[open.length - 1] === tag) {
      open.pop();
      return `</${tag}>`;
    }
    return '';
  }

  open.push(tag);
  return `<${tag}${keepAttributes(attributes, rule.attributes)}>`;
}

/**
 * @param {*} html
 * @returns {string} markup containing only allowed tags
 */
function sanitizeRichText(html) {
  if (typeof html !== 'string' || html === '') return '';

  const ends = tagEnds(html);
  let out = '';
  let lastIndex = 0;
  // Set while inside a tag whose content must be dropped, so its text is
  // swallowed until the matching close.
  let dropping = null;
  const open = [];

  let start = html.indexOf('<');
  while (start !== -1) {
    const token = readTag(html, start, ends);
    if (token === null) {
      // Not a tag: the `<` stays in the text, and is escaped with it.
      start = html.indexOf('<', start + 1);
      continue;
    }

    if (!dropping) out += escapeText(html.slice(lastIndex, start));
    lastIndex = token.end;

    if (dropping) {
      if (token.isClose && token.tag === dropping) dropping = null;
    } else if (DROP_CONTENT.has(token.tag)) {
      if (!token.isClose) dropping = token.tag;
    } else {
      out += emitTag(token, open);
    }

    start = html.indexOf('<', token.end);
  }

  if (!dropping) out += escapeText(html.slice(lastIndex));

  // Close what the input left open, so a block cannot bleed formatting into the
  // rest of the email.
  while (open.length) out += `</${open.pop()}>`;

  return out;
}

module.exports = { sanitizeRichText, ALLOWED };
