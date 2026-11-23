'use strict';

// The declarations of an inline style, parsed once per element and the same
// way for every reader: the quality control and the visible text of a value.
// `!important` is dropped, since the value is what matters here.

// The declarations of a style text, cut on the `;` that end one: never on
// one inside parentheses or quotes, as in `url(data:image/png;base64,…)`.
function splitDeclarations(text) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ';' && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

// A `style=""` text, as `[{ prop, value }]` in source order.
function parseDeclarations(styleText) {
  return splitDeclarations(String(styleText || ''))
    .map((decl) => {
      const at = decl.indexOf(':');
      if (at === -1) return null;
      return {
        prop: decl.slice(0, at).trim().toLowerCase(),
        value: decl
          .slice(at + 1)
          .replace(/!\s*important\s*$/i, '')
          .trim(),
      };
    })
    .filter((decl) => decl && decl.prop && decl.value);
}

// An element's style never changes once parsed: read once per element.
const parsed = new WeakMap();

function declarationsOf(el) {
  if (!el || !el.getAttribute) return [];
  if (!parsed.has(el)) {
    parsed.set(el, parseDeclarations(el.getAttribute('style')));
  }
  return parsed.get(el);
}

module.exports = { parseDeclarations, declarationsOf };
