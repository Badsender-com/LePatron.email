'use strict';

// A FreeMarker directive typed in a text field (`<#if …>`, `<#else>`, `</#if>`)
// leaves the export frame as text: the DOM serializes its `<` and `>` as
// `&lt;` and `&gt;`, and the sending platform no longer sees a directive.
// Each directive is put back on its own, so the text between two of them keeps
// its escaping.
//
// The `<#list>` spans are restored before, with all they hold, by the ESP tags
// step of viewmodel.js exportHTML: this pass only meets what that one left.

const LT = '&lt;';
const GT = '&gt;';
const DIRECTIVE_START = /&lt;\/?#(--|[a-zA-Z])/g;

// Besides `&lt;`, the only entities the DOM writes in a text node. A `<` put
// back inside a directive could open a real element in the export, so a
// directive holding one stays escaped (FreeMarker compares with `lt`).
const TEXT_ENTITIES = /&(amp|gt|nbsp);/g;
// FreeMarker does not read a non-breaking space as whitespace, and TinyMCE
// writes one for every repeated space.
const DECODED = { amp: '&', gt: '>', nbsp: ' ' };

const decode = (text) => text.replace(TEXT_ENTITIES, (_, name) => DECODED[name]);

const breaksTheDirective = (html, i) =>
  html[i] === '<' || html[i] === '>' || html.startsWith(LT, i);

/**
 * Where the `&gt;` closing a directive starts, or -1. A `&gt;` inside a string
 * or between parentheses is an operator, not the end.
 *
 * @param {string} html
 * @param {number} from - just after the directive's `&lt;`
 * @returns {number}
 */
function findTagEnd(html, from) {
  let depth = 0;
  let quote = null;
  for (let i = from; i < html.length; i++) {
    const char = html[i];
    if (breaksTheDirective(html, i)) return -1;
    if (quote) {
      if (char === '\\') i++;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '(') {
      depth++;
    } else if (char === ')') {
      depth--;
    } else if (depth <= 0 && html.startsWith(GT, i)) {
      return i;
    }
  }
  return -1;
}

// A comment ends at `-->` whatever it holds: an apostrophe there is prose.
function findCommentEnd(html, from) {
  const end = html.indexOf(`--${GT}`, from + '#--'.length);
  if (end === -1) return -1;
  for (let i = from; i < end; i++) {
    if (breaksTheDirective(html, i)) return -1;
  }
  return end + '--'.length;
}

/**
 * The exported HTML with its escaped FreeMarker directives put back.
 *
 * @param {string} html - the export frame's serialized document
 * @returns {string}
 */
function restoreFreemarkerDirectives(html) {
  let restored = '';
  let last = 0;
  DIRECTIVE_START.lastIndex = 0;
  let start;
  while ((start = DIRECTIVE_START.exec(html))) {
    const from = start.index + LT.length;
    const end =
      start[1] === '--' ? findCommentEnd(html, from) : findTagEnd(html, from);
    if (end === -1) continue;
    restored += `${html.slice(last, start.index)}<${decode(
      html.slice(from, end)
    )}>`;
    last = end + GT.length;
    DIRECTIVE_START.lastIndex = last;
  }
  return restored + html.slice(last);
}

module.exports = { restoreFreemarkerDirectives };
