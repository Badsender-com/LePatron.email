'use strict';

// Image element. The markup, and the reasons for its attributes, are in
// components/image.vue; see index.js for how it gets here.
//
// The `src` is expected to come from the editor's gallery, which is what
// rewrites URLs for the CDN and the FTP export at download time. A free URL
// field would bypass that — a point for whoever wires the panel.

const { defineTemplate } = require('../template.js');
const { defaultsOf } = require('../manifest.js');

// Two compiled variants rather than one conditional: the engine renders slots,
// it does not branch. An image with no link must not ship an empty `<a>`, so
// the `v-if` in the component is resolved at build time, once per variant, and
// all that is left to decide here is which of the two to use.
const templates = require('../components/image.compiled.js');

const renderPlain = defineTemplate(templates.plain);
const renderLinked = defineTemplate(templates.linked);

/**
 * @param {Object} [values]
 * @returns {string}
 */
function render(values) {
  const source = values || {};
  const href = typeof source.href === 'string' ? source.href.trim() : '';
  return href === '' ? renderPlain(source) : renderLinked(source);
}

// Both shapes, for the gallery and for tests that assert on either branch.
render.slots = renderLinked.slots;
render.variants = { plain: renderPlain, linked: renderLinked };

// Typed as the generator expects — see ../manifest.js.
const defaults = defaultsOf(require('../components/image.slots.js'));

module.exports = { type: 'image', render, defaults };
