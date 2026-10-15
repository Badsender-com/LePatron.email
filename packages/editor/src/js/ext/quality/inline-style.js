'use strict';

// Inline styles as the export carries them, parsed once and the same way for
// every rule. CSS keeps the last declaration of a property; `!important` is
// dropped, since the value is what matters here.

// A `style=""` text, as `[{ prop, value }]` in source order.
function parseDeclarations(styleText) {
  return String(styleText || '')
    .split(';')
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

// The value an element's inline style gives a property, or undefined. The
// last declaration wins, as in CSS.
function styleValue(el, prop) {
  const found = declarationsOf(el).filter((decl) => decl.prop === prop);
  return found.length ? found[found.length - 1].value : undefined;
}

// A CSS length in px (pt converted), or null. em, rem and % depend on a parent
// size the export does not always declare: they are left unread rather than
// guessed.
function toPx(value) {
  const m = /^([\d.]+)\s*(px|pt)?$/i.exec(String(value || '').trim());
  if (!m) return null;
  const n = Number(m[1]);
  return (m[2] || 'px').toLowerCase() === 'pt' ? n * (4 / 3) : n;
}

// The nearest value of a property up the tree that `parse` accepts, or null.
function inherited(element, prop, parse) {
  for (let el = element; el && el.nodeType === 1; el = el.parentElement) {
    const value = parse(styleValue(el, prop));
    if (value) return value;
  }
  return null;
}

// The font size an element's text is drawn at, in px, from its own or its
// ancestors' inline styles; null when only a stylesheet knows it.
const fontPxOf = (element) => inherited(element, 'font-size', toPx);

module.exports = {
  parseDeclarations,
  declarationsOf,
  styleValue,
  toPx,
  inherited,
  fontPxOf,
};
