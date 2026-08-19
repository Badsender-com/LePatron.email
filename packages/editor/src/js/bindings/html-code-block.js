'use strict';

const ko = require('knockout');
const { HTML_CODE_BINDING } = require('../ext/html-code-block/constants.js');

// Renders the pasted markup of an "HTML code" block.
//
// Modelled on `virtualHtml` (bindings/virtuals.js): `init` is Knockout's own
// `html` init, which returns `{ controlsDescendantBindings: true }`, so Knockout
// never applies bindings to the injected nodes — a `data-bind` inside pasted
// markup stays inert.
//
// The canvas preview is neutralized in a later step; the stored value and the
// exported HTML are never touched.
ko.bindingHandlers[HTML_CODE_BINDING] = {
  init: ko.bindingHandlers.html.init,
  update: function (element, valueAccessor) {
    return ko.bindingHandlers.html.update(element, valueAccessor);
  },
};
ko.virtualElements.allowedBindings[HTML_CODE_BINDING] = true;
