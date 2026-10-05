'use strict';

const ko = require('knockout');
const { HTML_CODE_BINDING } = require('../ext/html-code-block/constants.js');
const {
  neutralizeHtmlForPreview,
} = require('../ext/html-code-block/neutralize-html.js');
const {
  registerMarkup,
} = require('../ext/html-code-block/export-substitution.js');

// Renders the pasted markup of an "HTML code" block.
//
// Modelled on `virtualHtml` (bindings/virtuals.js): `init` is Knockout's own
// `html` init, which returns `{ controlsDescendantBindings: true }`, so Knockout
// never applies bindings to the injected nodes — a `data-bind` inside pasted
// markup stays inert.
//
// In the canvas (`templateMode === 'wysiwyg'`) the markup is neutralized before
// being injected, because that DOM is the editor's own document and same-origin
// with the user's session. The export frame built by viewModel.exportHTML
// renders an inert marker instead, swapped back for the raw bytes at the end of
// the export, so the downloaded HTML, the test send and the ESP exports keep the
// markup exactly as pasted. Any other mode gets the neutralized markup too.
//
// The neutralized markup is derived on the fly and never written back to the
// model: the stored value stays the pasted markup, byte for byte.
// A link in the canvas is something to look at, not to follow: a composed
// button with no URL yet is `href="#"`, and following it opened the editor
// again in another tab. Cancelled without stopping the click, so the block is
// still selected by it.
function keepLinksInPlace(event) {
  const link =
    event.target && event.target.closest && event.target.closest('a');
  if (link) event.preventDefault();
}

ko.bindingHandlers[HTML_CODE_BINDING] = {
  init: function (element, valueAccessor, allBindings, viewModel, context) {
    if (context && context.templateMode === 'wysiwyg') {
      element.addEventListener('click', keepLinksInPlace);
    }
    return ko.bindingHandlers.html.init.apply(this, arguments);
  },
  update: function (
    element,
    valueAccessor,
    allBindingsAccessor,
    viewModel,
    bindingContext
  ) {
    const isCanvas =
      bindingContext && bindingContext.templateMode === 'wysiwyg';
    const html = ko.utils.unwrapObservable(valueAccessor());

    let rendered;
    if (isCanvas) {
      rendered = neutralizeHtmlForPreview(html);
    } else {
      // During an export, render an inert marker and let the raw bytes be swapped
      // back at the end of the cascade, so the markup never goes through the DOM
      // or the shared regexes. Outside an export there is no session and the
      // markup is rendered directly, exactly as before.
      //
      // Outside both, the markup is neutralized as in the canvas: no rendering
      // path is known to reach this today, and one added later must not get raw
      // markup into the editor's document by default.
      const marker = registerMarkup(html);
      rendered = marker === null ? neutralizeHtmlForPreview(html) : marker;
    }

    return ko.bindingHandlers.html.update(element, function () {
      return rendered;
    });
  },
};
ko.virtualElements.allowedBindings[HTML_CODE_BINDING] = true;
