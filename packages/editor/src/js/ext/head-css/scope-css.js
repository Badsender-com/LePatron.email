'use strict';

// Rewrites the author's stylesheet so it applies to the canvas and nowhere else.
//
// The canvas is not an iframe: `#main-wysiwyg-area` is a plain div of the
// editor's own document. A rule like `.classred { color: red }` dropped into
// that document as-is would also hit the editor's chrome — the toolbox, the
// panels, the dialogs. Mosaico solves this for the template's own CSS by
// prefixing every selector with `#main-wysiwyg-area ` (converter/stylesheet.js);
// this does the same for the head CSS.
//
// Parsed with mensch, already a dependency and already the parser Mosaico
// trusts for exactly this job — with one correction. mensch splits a selector
// list on every comma, including the ones inside `:not(...)`, `[title="a,b"]`
// or `:is(...)`: it hands back `['.a:not(.b', '.c)']` for `.a:not(.b,.c)`.
// Prefixing those halves produces broken CSS, so the list is joined back and
// re-split here, respecting brackets and quotes.

const cssParse = require('mensch/lib/parser.js');
const cssStringify = require('mensch/lib/stringify.js');
const { ALWAYS_TRUE_MEDIA } = require('../preview-media.js');

// The document root of an email (`html`, `:root`) is the canvas itself here,
// and its <body> is the `replacedbody` element inside it: template-loader.js
// renames the template's html/head/body tags, attributes kept, so a div can
// hold them. Nesting either under the prefix would target a nonexistent
// `#main-wysiwyg-area body`, so they are translated instead, wherever they
// lead a selector: `body.dark .x` keeps its meaning on the canvas.
const ROOT_TYPE = /^(?:html|:root)(?![\w-])/i;
const BODY_TYPE = /^body(?![\w-])/i;
const CANVAS_BODY = 'replacedbody';

// The combinator after the root compound. Turned into a plain descendant one:
// the canvas does not nest the body directly under its root.
const LEADING_COMBINATOR = /^\s*[>+~]?\s*/;

// At-rules whose inner blocks hold selectors to rewrite.
const NESTING_AT_RULES = new Set(['media', 'supports', 'document']);

// What else the canvas copy keeps: rules, comments, and the at-rules that
// define something rather than apply it. Everything else — `@import` first,
// which would bring a stylesheet in unscoped, then `@namespace`, `@page` and
// whatever this parser does not know — is left out of the canvas only; the
// export still ships the stylesheet as written.
const KEPT_TYPES = new Set(['rule', 'comment', 'font-face', 'keyframes']);

// After an already-scoped prefix, a sibling combinator leaves the canvas.
const LEAVES_CANVAS = /^\s*[+~]/;

// What would make the prefix the start of a longer name — another element's id
// or class — rather than the canvas itself.
const CONTINUES_NAME = /^[\w-]/;

/**
 * Splits a selector list on its top-level commas only.
 *
 * @param {string} selectorText
 * @returns {Array<string>}
 */
function splitSelectorList(selectorText) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let current = '';

  for (let i = 0; i < selectorText.length; i++) {
    const char = selectorText[i];

    if (quote) {
      if (char === quote && selectorText[i - 1] !== '\\') quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '(' || char === '[') {
      depth++;
    } else if (char === ')' || char === ']') {
      if (depth > 0) depth--;
    } else if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  parts.push(current);
  return parts;
}

/**
 * Length of the compound selector `text` starts with: up to the first
 * combinator or whitespace outside brackets, parentheses and quotes.
 *
 * @param {string} text
 * @returns {number}
 */
function compoundLength(text) {
  let depth = 0;
  let quote = null;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (quote) {
      if (char === quote && text[i - 1] !== '\\') quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '(' || char === '[') {
      depth++;
    } else if (char === ')' || char === ']') {
      if (depth > 0) depth--;
    } else if (depth === 0 && /[\s>+~]/.test(char)) {
      return i;
    }
  }

  return text.length;
}

/**
 * Whether a selector already targets the canvas — an author pasting rules
 * copied out of the template — and only what is inside it.
 *
 * The sibling check looks past the prefix's whole compound, not just the
 * prefix: `#main-wysiwyg-area:has(*) ~ *` reaches the canvas's siblings as
 * surely as `#main-wysiwyg-area ~ *`.
 *
 * @param {string} trimmed the selector, trimmed
 * @param {string} prefix
 * @returns {boolean}
 */
function isAlreadyScoped(trimmed, prefix) {
  if (trimmed.indexOf(prefix) !== 0) return false;
  const afterPrefix = trimmed.slice(prefix.length);
  if (CONTINUES_NAME.test(afterPrefix)) return false;
  return !LEAVES_CANVAS.test(afterPrefix.slice(compoundLength(afterPrefix)));
}

/**
 * @param {string} selector
 * @param {string} prefix
 * @returns {string}
 */
function scopeSelector(selector, prefix) {
  const trimmed = selector.trim();
  if (trimmed === '') return selector;
  if (isAlreadyScoped(trimmed, prefix)) return trimmed;

  let scoped = prefix;
  let rest = trimmed;

  const root = ROOT_TYPE.exec(rest);
  if (root) {
    // What else the root compound says stays on the prefix: `html.a` -> `#area.a`.
    rest = rest.slice(root[0].length);
    const length = compoundLength(rest);
    scoped += rest.slice(0, length);
    rest = rest.slice(length).replace(LEADING_COMBINATOR, '');
    if (rest === '') return scoped;
  }

  const body = BODY_TYPE.exec(rest);
  if (body) rest = CANVAS_BODY + rest.slice(body[0].length);

  return scoped + ' ' + rest;
}

/**
 * Rewrites selectors in place, descending into the at-rules that nest them.
 *
 * `keyframes` is deliberately not in NESTING_AT_RULES: its inner "selectors"
 * are percentages and `from`/`to`, which must stay exactly as written.
 *
 * @param {Array} rules mensch AST nodes
 * @param {string} prefix
 * @param {{ forceMedia: boolean, mediaSelectorSuffix: string }} media see
 *   preview-media.js
 * @param {string} suffix appended to every selector, inside a forced media rule
 * @returns {Array} the rules the canvas keeps (see KEPT_TYPES)
 */
function scopeRules(rules, prefix, media, suffix) {
  if (!Array.isArray(rules)) return [];

  const kept = rules.filter(
    (rule) =>
      rule && (KEPT_TYPES.has(rule.type) || NESTING_AT_RULES.has(rule.type))
  );

  kept.forEach((rule) => {
    if (rule.type === 'rule' && Array.isArray(rule.selectors)) {
      // Joined back before re-splitting: see the header on mensch's commas.
      rule.selectors = splitSelectorList(rule.selectors.join(',')).map(
        (selector) =>
          selector.trim() === '' ? selector : scopeSelector(selector, prefix) + suffix
      );
      return;
    }

    if (NESTING_AT_RULES.has(rule.type)) {
      // A media query never follows the canvas width: see preview-media.js.
      const forced = rule.type === 'media' && media.forceMedia;
      if (forced) rule.name = ALWAYS_TRUE_MEDIA;
      rule.rules = scopeRules(
        rule.rules,
        prefix,
        media,
        forced ? media.mediaSelectorSuffix : suffix
      );
    }
  });

  return kept;
}

/**
 * @param {string} css the author's stylesheet
 * @param {string} prefix the selector everything must live under
 * @param {Object} [options] what the preview mode does to media queries, as
 *   returned by previewMediaFor (preview-media.js)
 * @param {boolean} [options.forceMedia] make every media query's condition hold
 * @param {string} [options.mediaSelectorSuffix] appended to the selectors of
 *   the forced media rules
 * @returns {string|null} the scoped stylesheet, or null when the CSS cannot be
 *   parsed — the caller then applies nothing rather than something wrong
 */
function scopeCss(css, prefix, options) {
  if (typeof css !== 'string' || css.trim() === '') return '';
  if (typeof prefix !== 'string' || prefix.trim() === '') return null;

  let sheet;
  try {
    sheet = cssParse(css, { comments: true, position: true });
  } catch (error) {
    // Invalid CSS is a normal state while typing. Nothing is applied, and the
    // export is unaffected — it never goes through here.
    return null;
  }

  // mensch is lenient, like a browser: an unclosed block yields a rule with no
  // declarations rather than an exception. That is the behaviour we want — a
  // half-typed stylesheet styles what it can and nothing else.

  if (!sheet || sheet.type !== 'stylesheet' || !sheet.stylesheet) return null;

  const media = {
    forceMedia: Boolean(options && options.forceMedia),
    mediaSelectorSuffix: (options && options.mediaSelectorSuffix) || '',
  };
  sheet.stylesheet.rules = scopeRules(
    sheet.stylesheet.rules,
    prefix.trim(),
    media,
    ''
  );

  try {
    return cssStringify(sheet, { indentation: '' });
  } catch (error) {
    return null;
  }
}

module.exports = { scopeCss };
