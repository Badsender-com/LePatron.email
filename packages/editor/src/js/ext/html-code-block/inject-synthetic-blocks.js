'use strict';

const { HTML_CODE_BINDING } = require('./constants.js');
const { SYNTHETIC_BLOCKS } = require('./block-types.js');
const { descriptorFor } = require('./block-state.js');

// Pure string -> string preprocessing of a Mosaico template, applied before the
// template is compiled (see template-loader.js). It makes the synthetic blocks
// — "HTML code" and the block builder — available in every template without
// touching any client template.
//
// Two insertions:
//   1. a standalone <style> holding the block definitions, before </head>
//   2. the block markup, right after the drag-and-drop container's opening tag
//
// A standalone <style> rather than patching the template's existing
// `@supports -ko-blockdefs` rule: the parser processes every <style> and drops
// the ones it empties, so this leaves the client CSS untouched.
//
// The injection is UNCONDITIONAL — it must not depend on the template flags.
// checkmodel.js splices block types it cannot find in the definitions out of the
// stored content ("REMOVING IT!!"), and the autosave then persists that loss.
// Gating a definition would silently destroy the blocks of existing mailings.
// The flags only filter the palette (see orderPaletteBlockDefs).

/**
 * The `@supports -ko-blockdefs` rules declaring one synthetic block.
 *
 * `label` feeds the editing panel; the palette label comes from the i18n
 * dictionary via $root.t (see toolbox.tmpl.html), not from here.
 *
 * @param {Object} descriptor
 * @returns {string[]} lines
 */
function blockDefLines(descriptor) {
  const properties = [descriptor.htmlProperty, descriptor.stateProperty]
    .filter(Boolean)
    .join(' ');

  const lines = [
    '  ' +
      descriptor.type +
      ' { label: ' +
      descriptor.label +
      '; properties: ' +
      properties +
      '; }',
    '  ' +
      descriptor.htmlProperty +
      ' { label: ' +
      descriptor.label +
      '; widget: ' +
      descriptor.widget +
      '; }',
  ];

  // `widget: hidden` keeps the state in the model without giving it a row in the
  // property panel — it is JSON, and nobody edits it by hand.
  if (descriptor.stateProperty) {
    lines.push(
      '  ' +
        descriptor.stateProperty +
        ' { label: Block builder state; widget: hidden; }'
    );
  }

  return lines;
}

const BLOCK_DEFS_STYLE = [
  '<style type="text/css">',
  '@supports -ko-blockdefs {',
]
  .concat(SYNTHETIC_BLOCKS.reduce((all, d) => all.concat(blockDefLines(d)), []))
  .concat(['}', '</style>'])
  .join('\n');

/**
 * The canvas markup of one synthetic block.
 *
 * Two bare <div>s and nothing else. This wrapper carries NO presentation at all:
 * no table, no cell, no class on the root, no width, no align, no valign, no
 * bgcolor, no theme binding. Anything of the sort would either style the markup
 * or override what it inherits.
 *
 * Why no `<table><tr><td>`: an `align` on that cell set the markup's alignment
 * context, overriding the `text-align` it inherits from the template (`align`
 * maps to `text-align`, which IS inherited), so a table pasted with
 * align="center" would not center like a native block does. `valign` went with
 * it: it applied to a single cell whose content is self-contained, so it changed
 * nothing, and the wrapper is now strictly neutral.
 *
 * Why the markup sits one level down, behind `data-ko-display`:
 *   - `data-ko-display` is required, or the property is never "used",
 *     `_usecount` stays undefined and _propEditor returns '' — the widget would
 *     never show up in the panel (converter/editor.js, converter/model.js);
 *   - it CANNOT go on the block root: the converter throws outright
 *     ("Unsupported data-ko-display used together with data-ko-block"), and the
 *     same holds for data-ko-wrap;
 *   - so the whole visible payload hangs off it, and an empty block exports the
 *     bare root and nothing else.
 *
 * The root carries the descriptor's root class so the export can drop it when the
 * block is empty — see strip-empty-blocks.js. The class is unstyled: it exists
 * purely as a hook.
 *
 * @param {Object} descriptor
 * @returns {string}
 */
function blockMarkup(descriptor) {
  return [
    '<div class="' +
      descriptor.rootClass +
      '" data-ko-block="' +
      descriptor.type +
      '">',
    '<div class="' +
      descriptor.markerClass +
      '" data-ko-display="' +
      descriptor.htmlProperty +
      '" data-bind="' +
      HTML_CODE_BINDING +
      ': ' +
      descriptor.htmlProperty +
      '"></div>',
    '</div>',
  ].join('');
}

const ALL_BLOCKS_MARKUP = SYNTHETIC_BLOCKS.map(blockMarkup).join('');

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
 * True when the template already declares or uses one of the synthetic blocks.
 *
 * All or nothing, on purpose: injecting the missing one into a template that
 * ships its own version of the other would put our definitions next to theirs,
 * and the parser would see the same block type declared twice.
 *
 * @param {string} markup
 * @returns {boolean}
 */
function alreadyPresent(markup) {
  return SYNTHETIC_BLOCKS.some(
    (descriptor) =>
      markup.indexOf('data-ko-block="' + descriptor.type + '"') !== -1 ||
      new RegExp('\\b' + descriptor.type + '\\s*\\{').test(markup)
  );
}

/**
 * @param {string} markup raw template markup
 * @returns {string} the markup with the synthetic blocks made available, or the
 *   input unchanged when they cannot be injected safely
 */
function injectSyntheticBlocks(markup) {
  if (!markup || typeof markup !== 'string') return markup;

  // Idempotent, and never fight a template that ships its own version.
  if (alreadyPresent(markup)) return markup;

  const containerEnd = findContainerContentStart(markup);
  if (containerEnd === -1 || !HEAD_CLOSE.test(markup)) return markup;

  const withBlocks =
    markup.slice(0, containerEnd) +
    ALL_BLOCKS_MARKUP +
    markup.slice(containerEnd);

  return withBlocks.replace(HEAD_CLOSE, (match) => BLOCK_DEFS_STYLE + match);
}

/**
 * Palette entries, in display order. The synthetic blocks always go last, each
 * dropped when its own template flag is off.
 *
 * Applied only to the array handed to the view-model: the full `blockDefs` must
 * keep every synthetic definition so checkModel never splices stored blocks out.
 *
 * @param {Array} blockDefs
 * @param {Object} metadata the mailing metadata carrying the template flags
 * @returns {Array} a new array
 */
function orderPaletteBlockDefs(blockDefs, metadata) {
  if (!Array.isArray(blockDefs)) return blockDefs;

  const flags = metadata || {};
  const others = blockDefs.filter((def) => !descriptorFor(def));

  // Declaration order, not the template's — so the palette reads the same in
  // every template.
  const enabled = SYNTHETIC_BLOCKS.filter((descriptor) =>
    Boolean(flags[descriptor.flag])
  ).reduce(
    (all, descriptor) =>
      all.concat(blockDefs.filter((def) => descriptorFor(def) === descriptor)),
    []
  );

  return others.concat(enabled);
}

module.exports = { injectSyntheticBlocks, orderPaletteBlockDefs };
