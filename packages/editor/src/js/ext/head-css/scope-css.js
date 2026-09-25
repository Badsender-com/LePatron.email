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

// Selectors that mean "the document" inside an email, and therefore mean "the
// canvas" here. Replaced by the prefix instead of being nested under it: an
// author writing `body { font-family: X }` wants the canvas to get that font,
// not a nonexistent `#main-wysiwyg-area body`.
const DOCUMENT_SELECTORS = new Set(['html', 'body', ':root', '*']);

// At-rules whose inner blocks hold selectors to rewrite.
const NESTING_AT_RULES = new Set(['media', 'supports', 'document']);

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
 * @param {string} selector
 * @param {string} prefix
 * @returns {string}
 */
function scopeSelector(selector, prefix) {
  const trimmed = selector.trim();
  if (trimmed === '') return selector;
  if (DOCUMENT_SELECTORS.has(trimmed.toLowerCase())) return prefix;
  // Already scoped — an author pasting rules copied out of the template.
  if (trimmed.indexOf(prefix) === 0) return trimmed;
  return prefix + ' ' + trimmed;
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
function scopeRules(rules, prefix) {
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

    if (NESTING_AT_RULES.has(rule.type)) scopeRules(rule.rules, prefix);
  });
}

/**
 * @param {string} css the author's stylesheet
 * @param {string} prefix the selector everything must live under
 * @returns {string|null} the scoped stylesheet, or null when the CSS cannot be
 *   parsed — the caller then applies nothing rather than something wrong
 */
function scopeCss(css, prefix) {
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

  scopeRules(sheet.stylesheet.rules, prefix.trim());

  try {
    return cssStringify(sheet, { indentation: '' });
  } catch (error) {
    return null;
  }
}

module.exports = { scopeCss };
