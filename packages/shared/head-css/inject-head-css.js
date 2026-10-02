'use strict';

// Injects a stylesheet into the <head> of an exported mailing.
//
// Why a string -> string function rather than a Knockout binding or a <style>
// added to the template markup:
//
//   - the <head> of an export is not a literal, it is the Knockout render of
//     the `template-head` template (template-loader.js), so there is no DOM node
//     to target before the export frame is bound;
//   - every <style> present in the template markup is consumed by the parser,
//     which replaces its content with a `template:` binding and DROPS the
//     element entirely when the result is empty (converter/parser.js). A
//     <style> carrying user CSS would not survive that pass unchanged;
//   - applied on the final string, the CSS never goes through the export
//     cascade's regexes, the DOM re-serialisation, or the inliner.
//
// The inliner is not a threat here — LePatron calls juice's `inlineDocument`,
// which has no `removeStyleTags`, and only collects `<style data-inline="true">`
// (ext/inliner.js). A plain <style> already travels through it untouched. This
// function runs after it anyway.

// Matches the closing </head>, whatever its casing and inner whitespace.
const HEAD_CLOSE = /<\/head\s*>/i;

// Marks the injected element, so a second pass over a stored copy (the
// translated duplicate's previewHtml) replaces it instead of stacking a
// duplicate. An attribute rather than a class: this element is never styled,
// and the export cascade only warns about unknown `data-*` attributes on
// template markup, not on a <style> we add after the cascade has run.
const MARKER_ATTRIBUTE = 'data-lp-head-css';

// A CSS payload can never legitimately contain `</style`: the HTML parser ends
// the element at that sequence, whatever follows it — which would let pasted
// CSS close the block and open arbitrary markup. Neutralised by inserting a
// backslash, which keeps the bytes visible in the export while killing the tag.
const STYLE_CLOSE = /<\/style/gi;

const OPENING_TAG = '<style type="text/css" ' + MARKER_ATTRIBUTE + '="true">';
const CLOSING_TAG = '</style>';

// Matches an injected element, including its content. Only ever trusted when
// it opens inside the <head>: see findInjectedElement.
const INJECTED_ELEMENT = new RegExp(
  '<style[^>]*\\s' +
    MARKER_ATTRIBUTE +
    '\\s*=\\s*"true"[^>]*>[\\s\\S]*?<\\/style\\s*>',
  'i'
);

/**
 * Removes what would end the <style> element early.
 *
 * @param {string} css
 * @returns {string}
 */
function neutralizeStyleClose(css) {
  return css.replace(STYLE_CLOSE, '<\\/style');
}

/**
 * The element a previous pass injected, if it opens inside the <head>.
 *
 * Anything after the first </head> is the body, where an HTML code block may
 * hold a pasted `data-lp-head-css` element of its own: it belongs to the
 * author, and that block promises to export it byte for byte. Comparing the
 * opening tag, rather than searching the head segment only, keeps the element
 * found when the CSS itself contains `</head>`.
 *
 * @param {string} html
 * @param {number} headEnd index of the first </head>
 * @returns {RegExpExecArray|null}
 */
function findInjectedElement(html, headEnd) {
  const match = INJECTED_ELEMENT.exec(html);
  return match && match.index < headEnd ? match : null;
}

/**
 * Places the stylesheet just before </head>, or in place of the one a previous
 * pass injected.
 *
 * Built by slicing rather than `String#replace` with a string: the CSS is user
 * input, and `$&`, `` $` `` or `$'` in it would be read as replacement patterns.
 *
 * @param {string} html a complete exported document
 * @param {string} css the stylesheet to place in its <head>
 * @returns {string} the document with the stylesheet injected, or the input
 *   unchanged when there is nothing to inject or nowhere to put it
 */
function injectHeadCss(html, css) {
  if (typeof html !== 'string' || html === '') return html;

  // No </head> means this is not a document we can safely edit — an export is
  // never worth breaking over a stylesheet.
  const headEnd = html.search(HEAD_CLOSE);
  if (headEnd === -1) return html;

  const previous = findInjectedElement(html, headEnd);
  const hasCss = typeof css === 'string' && css.trim() !== '';

  // Nothing to add and nothing to clean up: return the very same string, so an
  // export without head CSS stays byte-for-byte what it was before.
  if (!hasCss && !previous) return html;

  // Dropping the CSS must also drop the element it used to live in.
  const element = hasCss
    ? OPENING_TAG + neutralizeStyleClose(css) + CLOSING_TAG
    : '';

  if (previous) {
    const end = previous.index + previous[0].length;
    return html.slice(0, previous.index) + element + html.slice(end);
  }
  return html.slice(0, headEnd) + element + html.slice(headEnd);
}

module.exports = {
  injectHeadCss,
  MARKER_ATTRIBUTE,
};
