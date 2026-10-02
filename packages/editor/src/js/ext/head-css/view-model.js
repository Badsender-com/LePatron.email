'use strict';

const ko = require('knockout');
const {
  HEAD_CSS_MAX_LENGTH,
} = require('../../../../../shared/head-css/constants.js');
const { hasHtmlCodeBlock, headCssToExport } = require('./exported-css.js');

// The head CSS members of the editor's view model: the stylesheet itself, the
// predicates the two entry points read (toolbox.tmpl.html,
// badsender-widget-code.js), and what opens the editor on it.
//
// Kept out of viewmodel.js so these rules can be tested without building a
// whole editor. Called from there, at the same point the members used to be
// declared, so plugins see them exactly as before.

/**
 * @param {Object} viewModel the editor view model (viewmodel.js)
 */
function addHeadCssToViewModel(viewModel) {
  // Stylesheet injected into the <head> of every export this editor produces.
  // Lives on the mailing rather than in the content model: Mosaico's checkModel
  // splices out any property the block definitions do not declare. Seeded from
  // `metadata.headCss` once the mailing is loaded (template-loader.js) and sent
  // back with the content on save (ext/badsender-server-storage.js).
  viewModel.headCss = ko.observable('');

  // Whether the author may edit the head CSS: the one place the editor decides
  // it, read by both entry points and by openHeadCssEditor below. Same template
  // flag as the HTML code block, for the reasons in
  // packages/server/mailing/head-css-guard.js, whose isHeadCssEnabled is the
  // server's counterpart. `metadata` is assigned after the view model is built
  // (template-loader.js), hence the lazy read.
  viewModel.isHeadCssEditable = function () {
    return Boolean(viewModel.metadata && viewModel.metadata.htmlBlockEnabled);
  };

  // Whether the mailing holds an HTML code block, which is what decides whether
  // the head CSS is exported at all (see exported-css.js). Read lazily, like
  // the flag: `content` is the view model's, set before this runs but only
  // filled once the mailing is loaded.
  viewModel.hasHtmlCodeBlock = function () {
    return hasHtmlCodeBlock(viewModel.content);
  };

  // What exportHTML injects (viewmodel.js), and what the canvas previews
  // (canvas-preview.js): the stored CSS while an HTML code block is present,
  // nothing otherwise. `headCss` itself is never cleared by this — the CSS is
  // kept for an undo, or a block added back.
  viewModel.exportedHeadCss = function () {
    return headCssToExport(viewModel.content, viewModel.headCss());
  };

  // Opens the shared CodeMirror modal on the stylesheet instead of a block
  // property. `toggleHtmlCodeModal` is set by the Vue component when it mounts;
  // guarded because the palette button exists before Vue has bound.
  viewModel.openHeadCssEditor = function () {
    if (!viewModel.isHeadCssEditable()) return;
    if (typeof viewModel.toggleHtmlCodeModal !== 'function') return;
    viewModel.toggleHtmlCodeModal(true, {
      accessor: viewModel.headCss,
      mode: 'css',
      titleKey: 'head-css-modal-title',
      placeholderKey: 'head-css-placeholder',
      tooLargeKey: 'head-css-too-large',
      maxLength: HEAD_CSS_MAX_LENGTH,
    });
  };
}

module.exports = { addHeadCssToViewModel };
