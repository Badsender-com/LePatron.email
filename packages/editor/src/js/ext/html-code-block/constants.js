'use strict';

// Shared identifiers for the generic "HTML code" block.
//
// The block is not declared in any client template: its definition and markup
// are injected client-side into every template before Mosaico compiles it.
// See docs/plans/html-code-block.md.

// Mosaico block type (`data-ko-block` value).
const HTML_CODE_BLOCK_TYPE = 'htmlCodeBlock';

// Name of the single content property holding the pasted markup.
//
// Deliberately NOT `htmlContent`: the AI translation pipeline treats any field
// matching /content$/i as translatable text
// (packages/server/translation/mosaico-text-extractor.js), which would send the
// pasted HTML to the LLM and have it rewritten.
const HTML_CODE_PROPERTY = 'htmlCode';

// Marks the element whose children hold the pasted markup. A CSS class, not a
// `data-*` attribute: the export cascade strips `data-bind` but leaves unknown
// `data-*` attributes in place *and* warns about them
// (viewmodel.js "Output HTML contains unexpected data- attributes"). A class
// needs no additional regex in that shared cascade, and is the same kind of
// leftover every Mosaico export already carries (`vb-outer`, `vb-row`...).
const HTML_CODE_MARKER_CLASS = 'lp-html-block';

// Marks the block root. Mosaico never lets a block root disappear — the
// converter throws on data-ko-display/data-ko-wrap there, and templateCreator
// stores the root's outerHTML — so an empty block would still export
// `<div id="ko_htmlCodeBlock_N"></div>`. This class is what lets the export
// strip that leftover (see strip-empty-blocks.js). A class rather than a
// `data-*` attribute for the same reason as above: the export cascade warns
// about unknown `data-*` attributes but ignores classes.
const HTML_CODE_ROOT_CLASS = 'lp-html-block-root';

// Knockout binding rendering the pasted markup.
const HTML_CODE_BINDING = 'lpHtmlCode';

// Maximum length of the pasted markup, enforced in the editor and on the server.
// `mailing.data` is an unvalidated Mixed field and `previewHtml` stores the
// rendered copy in the same document, against Mongo's 16MB per-document limit.
const HTML_CODE_MAX_LENGTH = 100000;

module.exports = {
  HTML_CODE_BLOCK_TYPE,
  HTML_CODE_PROPERTY,
  HTML_CODE_MARKER_CLASS,
  HTML_CODE_ROOT_CLASS,
  HTML_CODE_BINDING,
  HTML_CODE_MAX_LENGTH,
};
