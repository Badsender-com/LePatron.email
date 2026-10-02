'use strict';

// Image element.
//
// `display:block` kills the baseline gap clients leave under an inline image;
// `width` as an attribute AND in the style because Outlook reads the attribute
// and everything else reads the style; `max-width` plus `width:100%` so the
// image shrinks with its column instead of overflowing it.
//
// An image with no link must not ship an empty `<a>`, which some clients render
// as a focusable, underlined gap — hence the two variants.
//
// The `src` is expected to come from the editor's gallery, which is what
// rewrites URLs for the CDN and the FTP export at download time. A free URL
// field would bypass that — a point for whoever wires the panel.

const { defineTemplate } = require('../template.js');
const { defaultsOf } = require('../manifest.js');

// The markup is not written here any more. It is compiled from
// components/image.vue by `yarn block-builder:compile`, so the people who own
// the email HTML can write it as a Vue component — the dialect they already use
// on client templates — instead of a string of placeholders.
//
// Two compiled variants rather than one conditional: the engine renders slots,
// it does not branch. The `v-if` lives in the component and is resolved at
// build time, once per variant, so nothing is left to decide here but which of
// the two to use.
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
