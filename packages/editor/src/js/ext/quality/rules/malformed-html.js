'use strict';

const { htmlCodeBlocks } = require('../html-code');
const { SCRIPTING_MARKUP } = require('../merge-tag-syntax');

// Tags left open or closed in the wrong order in pasted code: browsers guess,
// email clients guess differently, and Outlook's Word engine guesses worst.
// Only the code of HTML code blocks is read: TinyMCE writes rich texts well
// formed. Kept conservative on purpose: what HTML lets you leave open (a <p>,
// an <li>, a <td>…) is never reported.
const VOID = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);
const OPTIONAL_CLOSE = new Set([
  'p',
  'li',
  'dt',
  'dd',
  'td',
  'th',
  'tr',
  'thead',
  'tbody',
  'tfoot',
  'option',
  'colgroup',
  'caption',
]);
// Comments (MSO conditional ones included), the content of raw elements and
// ESP scripting (merge-tag-syntax.js) are not markup to balance.
// Each alternative scans lazily to its own end, so a comment or a script left
// open costs one pass over the rest of the code: O(n·k), bounded by
// HTML_CODE_MAX_LENGTH (packages/shared/synthetic-blocks.js).
const SKIPPED = new RegExp(
  `<!--[\\s\\S]*?-->|<(script|style)\\b[\\s\\S]*?<\\/\\1\\s*>|${SCRIPTING_MARKUP.source}`,
  'gi'
);
// A `/` before `>` only closes a void element: `<div/>` opens a div, and
// `<a href=http://x.com/>` opens a link.
const TAG = /<(\/?)([a-z][a-z0-9-]*)\b[^>]*>/gi;

const closedLater = (markup, from, name) =>
  new RegExp(`</${name}\\s*>`, 'i').test(markup.slice(from));

/**
 * The first nesting problem of a markup, or null.
 * @returns {{ kind: 'unclosed'|'unexpected'|'misnested', tag: string }|null}
 */
function nestingProblem(html) {
  const stack = [];
  const markup = html.replace(SKIPPED, '');
  let match;
  TAG.lastIndex = 0;
  while ((match = TAG.exec(markup))) {
    const [, closing, rawName] = match;
    const name = rawName.toLowerCase();
    if (VOID.has(name)) continue;
    if (!closing) {
      stack.push(name);
      continue;
    }
    const at = stack.lastIndexOf(name);
    if (at === -1) return { kind: 'unexpected', tag: name };
    // Everything opened after it must be closable implicitly.
    const skipped = stack.slice(at + 1);
    const unclosed = skipped.find((tag) => !OPTIONAL_CLOSE.has(tag));
    if (unclosed) {
      // Closed further on (<b><i>x</b></i>): the tags overlap rather than
      // one being left open.
      const kind = closedLater(markup, TAG.lastIndex, unclosed)
        ? 'misnested'
        : 'unclosed';
      return { kind, tag: unclosed };
    }
    stack.length = at;
  }
  const left = stack.find((tag) => !OPTIONAL_CLOSE.has(tag));
  return left ? { kind: 'unclosed', tag: left } : null;
}

const MESSAGES = {
  unclosed: 'Tag never closed in the HTML code: <__tag__>',
  unexpected: 'Closing tag with no opening one in the HTML code: </__tag__>',
  misnested: 'Tag closed in the wrong order in the HTML code: <__tag__>',
};

module.exports = {
  id: 'malformed-html',
  category: 'technical',
  severity: 'warning',
  titleKey: 'HTML structure',
  passKey: 'The code of HTML code blocks is well formed',
  nestingProblem,
  run(ctx) {
    return htmlCodeBlocks(ctx)
      .map((block) => ({ ...block, problem: nestingProblem(block.html) }))
      .filter(({ problem }) => problem)
      .map(({ blockId, path, problem }) => ({
        messageKey: MESSAGES[problem.kind],
        params: { tag: problem.tag },
        blockId,
        propertyPath: path,
        value: `${problem.kind}:${problem.tag}`,
      }));
  },
};
