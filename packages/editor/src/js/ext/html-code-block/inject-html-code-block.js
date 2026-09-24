'use strict';

const {
  HTML_CODE_BLOCK_TYPE,
  HTML_CODE_PROPERTY,
  HTML_CODE_MARKER_CLASS,
  HTML_CODE_ROOT_CLASS,
  HTML_CODE_BINDING,
} = require('./constants.js');
const { isHtmlCodeBlock } = require('./block-state.js');

// Pure string -> string preprocessing of a Mosaico template, applied before the
// template is compiled (see template-loader.js). It makes the generic "HTML
// code" block available in every template without touching any client template.
//
// Two insertions:
//   1. a standalone <style> holding the block definitions, before </head>
//   2. the block markup, right after the drag-and-drop container's opening tag
//
// A standalone <style> rather than patching the template's existing
// `@supports -ko-blockdefs` rule: the parser processes every <style> and drops
// the ones it empties, so this leaves the client CSS untouched.
//
// The injection is UNCONDITIONAL — it must not depend on the template flag.
// checkmodel.js splices block types it cannot find in the definitions out of the
// stored content ("REMOVING IT!!"), and the autosave then persists that loss.
// Gating the definition would silently destroy the HTML blocks of existing
// mailings. The flag only filters the palette (see orderPaletteBlockDefs).

// `label` feeds the editing panel; the palette label comes from the i18n
// dictionary via $root.t (see toolbox.tmpl.html), not from here.
const BLOCK_DEFS_STYLE = [
  '<style type="text/css">',
  '@supports -ko-blockdefs {',
  '  ' +
    HTML_CODE_BLOCK_TYPE +
    ' { label: HTML code; properties: ' +
    HTML_CODE_PROPERTY +
    '; }',
  '  ' + HTML_CODE_PROPERTY + ' { label: HTML code; widget: code; }',
  '}',
  '</style>',
].join('\n');

// Two bare <div>s and nothing else. This wrapper carries NO presentation at all:
// no table, no cell, no class on the root, no width, no align, no valign, no
// bgcolor, no theme binding. Anything of the sort would either style the pasted
// markup or override what it inherits.
//
// Why no `<table><tr><td>`: an `align` on that cell set the pasted markup's
// alignment context, overriding the `text-align` it inherits from the template
// (`align` maps to `text-align`, which IS inherited), so a table pasted with
// align="center" would not center like a native block does. `valign` went with
// it: it applied to a single cell whose content is self-contained, so it changed
// nothing, and the wrapper is now strictly neutral.
//
// Why the pasted markup sits one level down, behind `data-ko-display`:
//   - `data-ko-display` is required, or the property is never "used",
//     `_usecount` stays undefined and _propEditor returns '' — the widget would
//     never show up in the panel (converter/editor.js, converter/model.js);
//   - it CANNOT go on the block root: the converter throws outright
//     ("Unsupported data-ko-display used together with data-ko-block"), and the
//     same holds for data-ko-wrap;
//   - so the whole visible payload hangs off it, and an empty block exports the
//     bare root and nothing else.
//
// The root carries HTML_CODE_ROOT_CLASS so the export can drop it when the block
// is empty: Mosaico never lets a block root disappear on its own (it throws on
// data-ko-display/data-ko-wrap there, and templateCreator stores the root's
// outerHTML), so `<div id="ko_htmlCodeBlock_N"></div>` would otherwise survive.
// See strip-empty-blocks.js. The class is unstyled — it exists purely as a hook.
const BLOCK_MARKUP = [
  '<div class="' +
    HTML_CODE_ROOT_CLASS +
    '" data-ko-block="' +
    HTML_CODE_BLOCK_TYPE +
    '">',
  '<div class="' +
    HTML_CODE_MARKER_CLASS +
    '" data-ko-display="' +
    HTML_CODE_PROPERTY +
    '" data-bind="' +
    HTML_CODE_BINDING +
    ': ' +
    HTML_CODE_PROPERTY +
    '"></div>',
  '</div>',
].join('');

const HEAD_CLOSE = /<\/head\s*>/i;

// The main container is the conventional drop zone; fall back to any container.
const MAIN_CONTAINER_ATTR = /data-ko-container\s*=\s*["']main["']/i;
const ANY_CONTAINER_ATTR = /data-ko-container/i;

/**
 * Index just past the `>` of the container's opening tag, or -1.
 *
 * Deliberately a linear scan rather than one regex matching the whole tag: an
 * attribute-list pattern such as `(?:"[^"]*"|'[^']*'|[^>])*?` repeated around the
 * attribute backtracks catastrophically on real templates (hundreds of KB, with
 * `style` attributes containing `>`), which hangs the editor at load time.
 *
 * @param {string} markup
 * @returns {number}
 */
function findContainerContentStart(markup) {
  const attr =
    MAIN_CONTAINER_ATTR.exec(markup) || ANY_CONTAINER_ATTR.exec(markup);
  if (!attr) return -1;

  // Walk back to the `<` opening the tag that carries the attribute.
  const tagStart = markup.lastIndexOf('<', attr.index);
  if (tagStart === -1) return -1;

  // Walk forward to that tag's `>`, ignoring any `>` inside a quoted value.
  let quote = null;
  for (let i = tagStart + 1; i < markup.length; i++) {
    const char = markup[i];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '>') {
      return i + 1;
    }
  }
  return -1;
}

/**
 * @param {string} markup raw template markup
 * @returns {string} the markup with the HTML code block made available, or the
 *   input unchanged when it cannot be injected safely
 */
function injectHtmlCodeBlock(markup) {
  if (!markup || typeof markup !== 'string') return markup;

  // Idempotent, and never fight a template that ships its own version.
  if (
    markup.indexOf('data-ko-block="' + HTML_CODE_BLOCK_TYPE + '"') !== -1 ||
    new RegExp('\\b' + HTML_CODE_BLOCK_TYPE + '\\s*\\{').test(markup)
  ) {
    return markup;
  }

  const containerEnd = findContainerContentStart(markup);
  if (containerEnd === -1 || !HEAD_CLOSE.test(markup)) return markup;

  const withBlock =
    markup.slice(0, containerEnd) + BLOCK_MARKUP + markup.slice(containerEnd);

  return withBlock.replace(HEAD_CLOSE, (match) => BLOCK_DEFS_STYLE + match);
}

/**
 * Palette entries, in display order. The synthetic block always goes last, and
 * is dropped entirely when the template flag is off.
 *
 * Applied only to the array handed to the view-model: the full `blockDefs` must
 * keep the synthetic definition so checkModel never splices stored blocks out.
 *
 * @param {Array} blockDefs
 * @param {boolean} htmlBlockEnabled
 * @returns {Array} a new array
 */
function orderPaletteBlockDefs(blockDefs, htmlBlockEnabled) {
  if (!Array.isArray(blockDefs)) return blockDefs;
  const others = blockDefs.filter((def) => !isHtmlCodeBlock(def));
  if (!htmlBlockEnabled) return others;
  return others.concat(blockDefs.filter(isHtmlCodeBlock));
}

module.exports = { injectHtmlCodeBlock, orderPaletteBlockDefs };
