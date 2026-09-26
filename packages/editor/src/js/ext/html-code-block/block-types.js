'use strict';

// The synthetic blocks: block types that exist in no client template and are
// injected into every one of them before Mosaico compiles it.
//
// There are two, and they are twins. Both hold a string of raw HTML that the
// canvas neutralises, the inliner must not touch, the export swaps back
// verbatim, and the strip pass removes when empty. What differs is only who
// writes that string — a user pasting markup, or the block builder generating
// it — and which template flag reveals them in the palette.
//
// They are declared here as data rather than written twice, because the machinery
// around them is the delicate part: every fix to the export cascade, the inliner
// protection or the empty-block strip would otherwise have to be made in two
// places and would eventually be made in one.
//
// ADDING A BLOCK HERE IS NOT FREE. The definitions are injected
// unconditionally (see inject-synthetic-blocks.js), so a type that ever ships
// must keep being declared forever: checkmodel.js splices out stored blocks
// whose type it cannot find, and the autosave then persists that loss.

/**
 * The generic "HTML code" block: the user pastes markup, LePatron renders it
 * and exports it byte for byte.
 */
const HTML_CODE_BLOCK = Object.freeze({
  type: 'htmlCodeBlock',

  // Deliberately NOT `htmlContent`: the AI translation pipeline treats any field
  // matching /content$/i as translatable text
  // (packages/server/translation/mosaico-text-extractor.js), which would send the
  // pasted HTML to the LLM and have it rewritten.
  htmlProperty: 'htmlCode',
  stateProperty: null,

  // The property editor widget. Mosaico passes any unknown `widget:` declaration
  // straight through and looks plugin widgets up before its own
  // (converter/editor.js #_propInput), so a name of ours needs no converter
  // change.
  widget: 'code',

  // `label` feeds the editing panel. The palette label comes from the i18n
  // dictionary under `paletteLabelKey` via $root.t (toolbox.tmpl.html).
  label: 'HTML code',
  paletteLabelKey: 'html-code-block-name',
  paletteIcon: 'lucide-code-2',

  // Marks the element whose children hold the markup. A CSS class, not a
  // `data-*` attribute: the export cascade strips `data-bind` but leaves unknown
  // `data-*` attributes in place *and* warns about them (viewmodel.js "Output
  // HTML contains unexpected data- attributes"). A class needs no additional
  // regex in that shared cascade, and is the same kind of leftover every Mosaico
  // export already carries (`vb-outer`, `vb-row`...).
  markerClass: 'lp-html-block',

  // Marks the block root. Mosaico never lets a block root disappear — the
  // converter throws on data-ko-display/data-ko-wrap there, and templateCreator
  // stores the root's outerHTML — so an empty block would still export
  // `<div id="ko_htmlCodeBlock_N"></div>`. This class is what lets the export
  // strip that leftover (see strip-empty-blocks.js).
  rootClass: 'lp-html-block-root',

  // Placeholder shown in the canvas while the block is empty. Such a block
  // renders nothing at all — its content sits behind the `ko if` that
  // data-ko-display generates — and `#main-edit-area .editable` has no
  // min-height, so without this the block is zero pixels tall and unclickable.
  emptyLabelKey: 'html-code-block-empty',

  // The template flag revealing it in the palette.
  flag: 'htmlBlockEnabled',
});

/**
 * The block builder: the user composes visually, the generator writes the markup.
 *
 * A block type of its own rather than a second way to fill the HTML code block.
 * The two are different promises — one hands the user the responsibility for the
 * HTML, the other keeps it — and that difference has to be visible where the user
 * chooses, in the palette, not hidden behind a button inside a block named after
 * the other one. It also lets a client have the builder *without* the code block,
 * which is precisely the client who wants the guard rails.
 */
const BLOCK_BUILDER_BLOCK = Object.freeze({
  type: 'blockBuilderBlock',

  // Matches none of TRANSLATABLE_FIELD_PATTERNS (/text$/, /title$/, /label$/,
  // /alt$/, /heading$/, /description$/, /caption$/, /placeholder$/, /content$/i),
  // so the generated markup is not sent to the LLM as if it were prose. The
  // builder's own text will be reached through `builderState` instead, by a
  // dedicated extractor — see the roadmap's step 5.
  htmlProperty: 'builderHtml',

  // The composition, as a serialised JSON STRING — not an object. checkmodel.js
  // compares the stored value's type against the generated model's and flags a
  // mismatch as an obsolete template, which greets the user with a scary dialog.
  // And it must be DECLARED, or the reverse pass deletes it from the stored
  // content on the next load ("found in model is not defined by template:
  // removing it!").
  //
  // Never rendered in the markup, so `_usecount` stays undefined and the
  // property editor returns '' — it lives in the model without showing up in
  // the panel.
  stateProperty: 'builderState',

  widget: 'blockBuilder',

  label: 'Composed block',
  paletteLabelKey: 'block-builder-block-name',
  paletteIcon: 'lucide-layout-template',

  markerClass: 'lp-builder-block',
  rootClass: 'lp-builder-block-root',
  emptyLabelKey: 'block-builder-block-empty',

  flag: 'blockBuilderEnabled',
});

const SYNTHETIC_BLOCKS = Object.freeze([HTML_CODE_BLOCK, BLOCK_BUILDER_BLOCK]);

/**
 * @param {string} type a Mosaico block type
 * @returns {Object|null} its descriptor, or null when it is a template's own block
 */
function descriptorForType(type) {
  if (!type || typeof type !== 'string') return null;
  return SYNTHETIC_BLOCKS.find((block) => block.type === type) || null;
}

module.exports = {
  HTML_CODE_BLOCK,
  BLOCK_BUILDER_BLOCK,
  SYNTHETIC_BLOCKS,
  descriptorForType,
};
