'use strict';

// Whether each slot's context suits the place it lands in.
//
// In the hand-written templates the context sat in the placeholder, next to
// the markup it guarded, where a reviewer could see that `[[href|URL]]` was in
// an `href`. Now the context lives in the manifest and the position in the
// .vue, and nothing tied the two: a TEXT slot moved into an attribute would
// have compiled, with an escape that does not stop a quote. So the rendered
// markup is scanned, each sentinel's position classified, and the context
// checked against it.

const { sentinelFor } = require('./markup-pipeline.js');

// Attributes whose value is fetched or followed. Only a URL slot may fill one,
// and only as the whole value: a fragment of a URL has no scheme of its own to
// check, and `isSafeUrl` judges the scheme.
const URL_ATTRIBUTES = new Set([
  'href',
  'src',
  'background',
  'action',
  'formaction',
  'poster',
  'xlink:href',
]);

// What may fill each position. Event handlers, tag and attribute names and
// comments accept nothing: no context escapes for those.
const ALLOWED = {
  text: ['TEXT', 'RICH_TEXT'],
  url: ['URL'],
  style: ['COLOR', 'PX', 'CSS_VALUE'],
  attribute: ['ATTR', 'COLOR', 'PX', 'CSS_VALUE'],
};

const TOKEN = /<!--[\s\S]*?-->|<\/?[a-zA-Z][^\s/>]*(?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?>/g;
const ATTRIBUTE = /\s+([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function attributePosition(attrName, value, sentinel) {
  const lower = attrName.toLowerCase();
  if (lower.startsWith('on')) return 'event handler';
  if (lower === 'style') return 'style';
  if (URL_ATTRIBUTES.has(lower)) {
    return value.trim() === sentinel ? 'url' : 'part of a URL';
  }
  return 'attribute';
}

/**
 * Every position a sentinel occupies in one tag.
 *
 * @returns {Array<string>}
 */
function positionsInTag(tag, sentinel) {
  const positions = [];
  const name = /^<\/?([^\s/>]+)/.exec(tag)[1];
  if (name.includes(sentinel)) positions.push('tag name');

  const attributes = tag.slice(tag.indexOf(name) + name.length);
  let match = ATTRIBUTE.exec(attributes);
  while (match !== null) {
    const [, attrName] = match;
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    if (attrName.includes(sentinel)) positions.push('attribute name');
    if (value.includes(sentinel)) {
      positions.push(attributePosition(attrName, value, sentinel));
    }
    match = ATTRIBUTE.exec(attributes);
  }
  ATTRIBUTE.lastIndex = 0;
  return positions;
}

/**
 * Every position a sentinel occupies in the markup.
 *
 * @param {string} html
 * @param {string} sentinel
 * @returns {Array<string>}
 */
function positionsOf(html, sentinel) {
  const positions = [];
  let last = 0;
  const text = (chunk) => {
    if (chunk.includes(sentinel)) positions.push('text');
  };

  TOKEN.lastIndex = 0;
  let match = TOKEN.exec(html);
  while (match !== null) {
    text(html.slice(last, match.index));
    if (match[0].startsWith('<!--')) {
      if (match[0].includes(sentinel)) positions.push('comment');
    } else {
      positions.push(...positionsInTag(match[0], sentinel));
    }
    last = match.index + match[0].length;
    match = TOKEN.exec(html);
  }
  text(html.slice(last));
  return positions;
}

/**
 * Throws when a slot lands somewhere its context does not escape for.
 *
 * @param {string} label e.g. `button (default)`
 * @param {string} html the markup still carrying the sentinels
 * @param {Object} slots the manifest's slots
 */
function checkSlotPlacement(label, html, slots) {
  Object.entries(slots).forEach(([slotName, { context }]) => {
    const positions = [...new Set(positionsOf(html, sentinelFor(slotName)))];
    // Not rendered by this variant: whether any variant renders it is checked
    // once they are all compiled.
    if (positions.length === 0) return;

    const fits = positions.map((position) => ALLOWED[position] || []);
    const common = fits.reduce((all, allowed) =>
      all.filter((c) => allowed.includes(c))
    );

    if (positions.length > 1 && common.length === 0) {
      throw new Error(
        `${label}: "${slotName}" lands in ${positions.join(' and ')}, ` +
          'which no single context escapes for. Use two slots.'
      );
    }
    const wrong = positions.find((p, i) => !fits[i].includes(context));
    if (wrong) {
      const allowed = ALLOWED[wrong] ? ALLOWED[wrong].join(', ') : 'nothing';
      throw new Error(
        `${label}: "${slotName}" is ${context} but lands in ${wrong}, ` +
          `which takes ${allowed}.`
      );
    }
  });
}

module.exports = { checkSlotPlacement, positionsOf };
