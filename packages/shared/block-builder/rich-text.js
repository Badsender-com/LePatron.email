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
// Deliberately not DOMPurify: it needs a DOM, so the server would need jsdom to
// regenerate a block during translation, and the allow-list here is six tags
// wide. A parser that small is easier to reason about — and to test — than a
// dependency configured down to the same six.

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

const TAG = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
const ATTRIBUTE = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;

/**
 * @param {string} raw the attribute section of a tag
 * @param {Array<string>} allowed attribute names this tag may keep
 * @returns {string} the attributes to emit, already escaped
 */
function keepAttributes(raw, allowed) {
  if (allowed.length === 0) return '';

  const kept = [];
  ATTRIBUTE.lastIndex = 0;

  let match = ATTRIBUTE.exec(raw);
  while (match !== null) {
    const name = match[1].toLowerCase();
    const value = match[3] ?? match[4] ?? match[5] ?? '';

    if (allowed.indexOf(name) !== -1) {
      // `href` is the only attribute on the list, and it is the one that can
      // execute. A refused URL drops the attribute rather than the link, so the
      // words stay readable.
      const safe =
        name === 'href'
          ? isSafeUrl(value)
            ? escapeAttribute(value.trim())
            : ''
          : escapeAttribute(value);
      if (safe !== '') kept.push(`${name}="${safe}"`);
    }

    match = ATTRIBUTE.exec(raw);
  }

  return kept.length ? ' ' + kept.join(' ') : '';
}

/**
 * @param {*} html
 * @returns {string} markup containing only allowed tags
 */
function sanitizeRichText(html) {
  if (typeof html !== 'string' || html === '') return '';

  let out = '';
  let lastIndex = 0;
  // Set while inside a tag whose content must be dropped, so its text is
  // swallowed until the matching close.
  let dropping = null;
  const open = [];

  TAG.lastIndex = 0;
  let match = TAG.exec(html);

  while (match !== null) {
    const [raw, name, attributes] = match;
    const tag = name.toLowerCase();
    const isClose = raw[1] === '/';
    const text = html.slice(lastIndex, match.index);

    if (!dropping) out += escapeText(text);
    lastIndex = match.index + raw.length;

    if (dropping) {
      if (isClose && tag === dropping) dropping = null;
    } else if (DROP_CONTENT.has(tag)) {
      if (!isClose) dropping = tag;
    } else if (Object.prototype.hasOwnProperty.call(ALLOWED, tag)) {
      const rule = ALLOWED[tag];
      if (rule.void) {
        out += `<${tag} />`;
      } else if (isClose) {
        // Only close what was opened, so a stray `</strong>` cannot close a tag
        // this function emitted around it.
        if (open.length && open[open.length - 1] === tag) {
          open.pop();
          out += `</${tag}>`;
        }
      } else {
        open.push(tag);
        out += `<${tag}${keepAttributes(attributes, rule.attributes)}>`;
      }
    }
    // Anything else: dropped, content kept.

    match = TAG.exec(html);
  }

  if (!dropping) out += escapeText(html.slice(lastIndex));

  // Close what the input left open, so a block cannot bleed formatting into the
  // rest of the email.
  while (open.length) out += `</${open.pop()}>`;

  return out;
}

module.exports = { sanitizeRichText, ALLOWED };
