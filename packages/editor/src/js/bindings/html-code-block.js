'use strict';

const ko = require('knockout');
const { HTML_CODE_BINDING } = require('../ext/html-code-block/constants.js');
const {
  neutralizeHtmlForPreview,
} = require('../ext/html-code-block/neutralize-html.js');

// Renders the pasted markup of an "HTML code" block.
//
// Modelled on `virtualHtml` (bindings/virtuals.js): `init` is Knockout's own
// `html` init, which returns `{ controlsDescendantBindings: true }`, so Knockout
// never applies bindings to the injected nodes — a `data-bind` inside pasted
// markup stays inert.
//
// In the canvas (`templateMode === 'wysiwyg'`) the markup is neutralized before
// being injected, because that DOM is the editor's own document and same-origin
// with the user's session. Every other mode — most importantly the export frame
// built by viewModel.exportHTML — receives the markup untouched, so the
// downloaded HTML, the test send and the ESP exports keep it exactly as pasted.
//
// The neutralized markup is derived on the fly and never written back to the
// model: the stored value stays the pasted markup, byte for byte.
ko.bindingHandlers[HTML_CODE_BINDING] = {
  init: ko.bindingHandlers.html.init,
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
    const rendered = isCanvas ? neutralizeHtmlForPreview(html) : html;

    return ko.bindingHandlers.html.update(element, function () {
      return rendered;
    });
  },
};
ko.virtualElements.allowedBindings[HTML_CODE_BINDING] = true;
