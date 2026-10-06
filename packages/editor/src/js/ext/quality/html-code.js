'use strict';

const { HTML_CODE_BLOCK } = require('../html-code-block/block-types');
const { allEditedRichTexts } = require('./user-styles');

// Markup the client wrote themselves: the code pasted in an "HTML code"
// block, always theirs, exported byte for byte (export-substitution.js).
// The rich texts they edited through TinyMCE's source view are markup too,
// but TinyMCE rewrites them well formed: only forbidden tags are looked for
// there.

/**
 * The code of every non-empty HTML code block.
 * @returns {Array<{ blockId: string, html: string }>}
 */
function htmlCodeBlocks(ctx) {
  return ctx.blocks
    .filter((block) => block && block.type === HTML_CODE_BLOCK.type)
    .map((block) => ({ blockId: block.id, html: block[HTML_CODE_BLOCK.htmlProperty] || '' }))
    .filter(({ html }) => html.trim());
}

/**
 * Markup the client wrote: HTML code blocks, then edited rich texts.
 * @returns {Array<{ blockId, path: string|null, html: string, source }>}
 */
function clientMarkup(ctx) {
  const code = htmlCodeBlocks(ctx).map((block) => ({
    ...block,
    path: HTML_CODE_BLOCK.htmlProperty,
    source: 'code',
  }));
  const richTexts = allEditedRichTexts(ctx).map((richText) => ({
    blockId: richText.blockId,
    path: richText.path,
    html: richText.root.innerHTML,
    source: 'richText',
  }));
  return code.concat(richTexts);
}

// The markup parsed in the inert export document: nothing runs, nothing loads.
function parseMarkup(ctx, html) {
  const root = ctx.doc.createElement('div');
  root.innerHTML = html;
  return root;
}

module.exports = { htmlCodeBlocks, clientMarkup, parseMarkup };
