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
// In packages/shared because both sides read this table: the editor injects and
// renders the blocks (ext/synthetic-blocks/block-types.js re-exports it), and the
// server gates and measures them (mailing/synthetic-block-guard.js,
// mailing/synthetic-block-sizes.js) and keeps
// their zones out of translation (translation/synthetic-block-protection.js).
// One table, so a renamed property cannot leave the server guarding a block
// that no longer exists — and letting everything through.
//
// ADDING A BLOCK HERE IS NOT FREE. The definitions are injected
// unconditionally (see packages/editor/src/js/ext/synthetic-blocks/
// inject-synthetic-blocks.js), so a type that ever ships must keep being
// declared forever: checkmodel.js splices out stored blocks whose type it cannot
// find, and the autosave then persists that loss.

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

  // Whether the editor offers its "Translate block" button. Not for this
  // block: the AI translation would rewrite markup the user pasted, and the
  // block's whole promise is that its HTML is never altered — nobody is offered
  // something that will not happen. Its markup is never sent to the LLM in any
  // case: the text extractor excludes every descriptor's `htmlProperty` and
  // `stateProperty` (mosaico-text-extractor.js).
  blockTranslatable: false,
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
  // builder's own text is reached through `builderState` instead, by a
  // dedicated extractor (packages/server/translation/builder-block-texts.js).
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

  // Composed blocks ARE translated with the whole mailing (duplicate +
  // translate) — on a template whose `flag` is on, which is the whole rule
  // (packages/server/translation/mailing-translation.js) — since the server
  // rebuilds their markup from the translated state with the same generator
  // the editor uses
  // (packages/server/translation/builder-block-texts.js). The generated HTML is
  // never sent anywhere — only the prose inside the state is.
  //
  // But not on their own: the per-block route translates a flat object of
  // fields and writes it back into the model, and knows nothing of a state to
  // translate and a markup to rebuild. Its button stays hidden until it does.
  blockTranslatable: false,
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

// Maximum length of a block's markup, enforced in the editor and on the server.
// `mailing.data` is an unvalidated Mixed field and `previewHtml` stores the
// rendered copy in the same document, against Mongo's 16MB per-document limit.
const HTML_CODE_MAX_LENGTH = 100000;

// Maximum length of the builder's serialised state, which sits next to the
// markup in the same block. It describes that markup — the same texts, the same
// URLs — so it is of the same order; twice the markup bound leaves room for JSON
// escaping while still refusing a state stuffed with what the generator would
// never render.
const BUILDER_STATE_MAX_LENGTH = HTML_CODE_MAX_LENGTH * 2;

// Maximum length of all the synthetic content of one content model added up:
// every block's markup and state, in characters. Each block is bounded above,
// but nothing bounds how many blocks a request brings. 3MB is thirty HTML code
// blocks, or ten composed blocks, at their maximum — far past any real email,
// whose composed blocks weigh a few kilobytes — and, with `previewHtml` (bounded
// at 5MB, server/utils/preview-html-sanitizer.js) in the same document, keeps a
// mailing well under Mongo's 16MB.
const SYNTHETIC_CONTENT_MAX_LENGTH = 3 * 1024 * 1024;

module.exports = {
  HTML_CODE_BLOCK,
  BLOCK_BUILDER_BLOCK,
  SYNTHETIC_BLOCKS,
  descriptorForType,
  HTML_CODE_MAX_LENGTH,
  BUILDER_STATE_MAX_LENGTH,
  SYNTHETIC_CONTENT_MAX_LENGTH,
};
