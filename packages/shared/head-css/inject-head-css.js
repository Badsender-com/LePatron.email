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

// Marks the injected element, so a second pass replaces it instead of stacking
// a duplicate. An attribute rather than a class: this element is never styled,
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

// Matches a previously injected element, including its content.
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
 * @param {string} html a complete exported document
 * @param {string} css the stylesheet to place in its <head>
 * @returns {string} the document with the stylesheet injected, or the input
 *   unchanged when there is nothing to inject or nowhere to put it
 */
function injectHeadCss(html, css) {
  if (typeof html !== 'string' || html === '') return html;

  const previous = INJECTED_ELEMENT.test(html);
  const hasCss = typeof css === 'string' && css.trim() !== '';

  // Nothing to add and nothing to clean up: return the very same string, so an
  // export without head CSS stays byte-for-byte what it was before.
  if (!hasCss && !previous) return html;

  // Dropping the CSS must also drop the element it used to live in.
  if (!hasCss) return html.replace(INJECTED_ELEMENT, '');

  const element = OPENING_TAG + neutralizeStyleClose(css) + CLOSING_TAG;

  if (previous) return html.replace(INJECTED_ELEMENT, element);

  // No </head> means this is not a document we can safely edit — an export is
  // never worth breaking over a stylesheet.
  if (!HEAD_CLOSE.test(html)) return html;

  return html.replace(HEAD_CLOSE, (match) => element + match);
}

module.exports = {
  injectHeadCss,
  MARKER_ATTRIBUTE,
};
