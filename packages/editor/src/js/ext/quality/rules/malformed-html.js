'use strict';

const { htmlCodeBlocks } = require('../html-code');

// Tags left open or closed in the wrong order in pasted code: browsers guess,
// email clients guess differently, and Outlook's Word engine guesses worst.
// Only the code of HTML code blocks is read: TinyMCE writes rich texts well
// formed. Kept conservative on purpose: what HTML lets you leave open (a <p>,
// an <li>, a <td>…) is never reported.
const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr',
]);
const OPTIONAL_CLOSE = new Set([
  'p', 'li', 'dt', 'dd', 'td', 'th', 'tr', 'thead', 'tbody', 'tfoot',
  'option', 'colgroup', 'caption',
]);
// Comments (MSO conditional ones included), and the content of raw elements,
// are not markup to balance; ESP scripting (<% %>, <#list>) neither.
const SKIPPED = /<!--[\s\S]*?-->|<(script|style)\b[\s\S]*?<\/\1\s*>|<%[\s\S]*?%>|<\/?#[^>]*>/gi;
const TAG = /<(\/?)([a-z][a-z0-9-]*)\b[^>]*?(\/?)>/gi;

/**
 * The first nesting problem of a markup, or null.
 * @returns {{ kind: 'unclosed'|'unexpected', tag: string }|null}
 */
function nestingProblem(html) {
  const stack = [];
  const markup = html.replace(SKIPPED, '');
  let match;
  TAG.lastIndex = 0;
  while ((match = TAG.exec(markup))) {
    const [, closing, rawName, selfClosing] = match;
    const name = rawName.toLowerCase();
    if (VOID.has(name) || selfClosing) continue;
    if (!closing) {
      stack.push(name);
      continue;
    }
    const at = stack.lastIndexOf(name);
    if (at === -1) return { kind: 'unexpected', tag: name };
    // Everything opened after it must be closable implicitly.
    const skipped = stack.slice(at + 1);
    const unclosed = skipped.find((tag) => !OPTIONAL_CLOSE.has(tag));
    if (unclosed) return { kind: 'unclosed', tag: unclosed };
    stack.length = at;
  }
  const left = stack.find((tag) => !OPTIONAL_CLOSE.has(tag));
  return left ? { kind: 'unclosed', tag: left } : null;
}

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
      .map(({ blockId, problem }) => ({
        messageKey:
          problem.kind === 'unclosed'
            ? 'Tag never closed in the HTML code: <__tag__>'
            : 'Closing tag with no opening one in the HTML code: </__tag__>',
        params: { tag: problem.tag },
        blockId,
        propertyPath: 'htmlCode',
        value: `${problem.kind}:${problem.tag}`,
      }));
  },
};
