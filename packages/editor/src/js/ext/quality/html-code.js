'use strict';

const { HTML_CODE_BLOCK } = require('../html-code-block/block-types');

// Read from the synthetic block descriptor, the one table the editor and the
// server share (packages/shared/synthetic-blocks.js).
const HTML_CODE_BLOCK_TYPE = HTML_CODE_BLOCK.type;
const HTML_CODE_PROPERTY = HTML_CODE_BLOCK.htmlProperty;
const { allEditedRichTexts } = require('./user-styles');

// Markup the client wrote themselves: the code pasted in an "HTML code"
// block, always theirs, exported byte for byte (export-substitution.js).
// The rich texts they edited through TinyMCE's source view are markup too,
// but TinyMCE rewrites them well formed: only forbidden tags are looked for
// there.

// The markup parsed in the inert export document: nothing runs, nothing loads.
function parseMarkup(ctx, html) {
  const root = ctx.doc.createElement('div');
  root.innerHTML = html;
  return root;
}

/**
 * The code of every non-empty HTML code block, parsed once per run.
 * @returns {Array<{ blockId: string, path: string, html: string, root: Element }>}
 */
function htmlCodeBlocks(ctx) {
  if (!ctx.cache.htmlCodeBlocks) {
    ctx.cache.htmlCodeBlocks = ctx.blocks
      .filter((block) => block && block.type === HTML_CODE_BLOCK_TYPE)
      .map((block) => ({
        blockId: block.id,
        path: HTML_CODE_PROPERTY,
        html: block[HTML_CODE_PROPERTY] || '',
      }))
      .filter(({ html }) => html.trim())
      .map((block) => ({ ...block, root: parseMarkup(ctx, block.html) }));
  }
  return ctx.cache.htmlCodeBlocks;
}

/**
 * Markup the client wrote, parsed: HTML code blocks, then edited rich texts.
 * @returns {Array<{ blockId, path: string, root: Element, source }>}
 */
function clientMarkup(ctx) {
  const code = htmlCodeBlocks(ctx).map(({ blockId, path, root }) => ({
    blockId,
    path,
    root,
    source: 'code',
  }));
  const richTexts = allEditedRichTexts(ctx).map(({ blockId, path, root }) => ({
    blockId,
    path,
    root,
    source: 'richText',
  }));
  return code.concat(richTexts);
}

// `/* display:flex */` is no flexbox: comments are not CSS.
const stripCssComments = (css) =>
  String(css || '').replace(/\/\*[\s\S]*?\*\//g, '');

module.exports = { htmlCodeBlocks, clientMarkup, stripCssComments };
