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

// A condition that is always true, used to make mobile rules apply while the
// mobile preview is on. Same value, and same blunt approach, as
// badsender-screen-preview.js uses on the template's own stylesheet: EVERY
// media query is forced, not only the `max-width` ones. A desktop-only
// `min-width` query would therefore apply too — wrong in theory, but it is the
// behaviour the template already has, and diverging would be worse than
// matching it.
const ALWAYS_TRUE_MEDIA = 'only screen and (min-width: 0px)';

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
 * @param {string} selector
 * @param {string} prefix
 * @returns {string}
 */
function scopeSelector(selector, prefix) {
  const trimmed = selector.trim();
  if (trimmed === '') return selector;
  // Already scoped — an author pasting rules copied out of the template.
  if (trimmed.indexOf(prefix) === 0) return trimmed;

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
 */
function scopeRules(rules, prefix, forceMedia) {
  if (!Array.isArray(rules)) return;

  rules.forEach((rule) => {
    if (!rule) return;

    if (rule.type === 'rule' && Array.isArray(rule.selectors)) {
      // Joined back before re-splitting: see the header on mensch's commas.
      rule.selectors = splitSelectorList(rule.selectors.join(',')).map(
        (selector) => scopeSelector(selector, prefix)
      );
      return;
    }

    if (NESTING_AT_RULES.has(rule.type)) {
      // The canvas is a div, so a media query is evaluated against the browser
      // window, never against the canvas width. Shrinking the canvas to 350px
      // for the mobile preview therefore triggers nothing on its own: the
      // condition has to be neutralised for the rules to show.
      if (rule.type === 'media' && forceMedia) rule.name = ALWAYS_TRUE_MEDIA;
      scopeRules(rule.rules, prefix, forceMedia);
    }
  });
}

/**
 * @param {string} css the author's stylesheet
 * @param {string} prefix the selector everything must live under
 * @param {Object} [options]
 * @param {boolean} [options.forceMedia] make every media query apply, for the
 *   mobile preview
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

  scopeRules(
    sheet.stylesheet.rules,
    prefix.trim(),
    Boolean(options && options.forceMedia)
  );

  try {
    return cssStringify(sheet, { indentation: '' });
  } catch (error) {
    return null;
  }
}

module.exports = { scopeCss };
