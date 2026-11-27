'use strict';

// Image element. The markup, and the reasons for its attributes, are in
// components/image.vue; see index.js for how it gets here.
//
// The `src` is expected to come from the editor's gallery, which is what
// rewrites URLs for the CDN and the FTP export at download time. A free URL
// field would bypass that — a point for whoever wires the panel.

const { defineTemplate } = require('../template.js');
const { defaultsOf, translatableOf, requiredOf } = require('../manifest.js');

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

const manifest = require('../components/image.slots.js');

// Typed as the generator expects — see ../manifest.js.
const defaults = defaultsOf(manifest);

// What a translation may rewrite — see ../manifest.js.
const translatable = translatableOf(manifest);

// A size as the PX context reads it, or the slot's default when it is not one.
const pixels = (value, fallback) => {
  const number = Number.parseInt(String(value), 10);
  return Number.isFinite(number) ? number : fallback;
};

/**
 * The values to render in a column `available` px wide.
 *
 * Outlook on Windows ignores `max-width` and lays an image out at its `width`
 * attribute, so a 600px image in a half-width column would push the email
 * wider. The width written is the image's own, or the room its column leaves
 * once the image's side padding is taken out, whichever is smaller. An image
 * that already fits keeps its values untouched.
 *
 * @param {Object} values merged with the defaults
 * @param {number} available the column's width, in px
 * @returns {Object}
 */
function fitWidth(values, available) {
  const room = Math.max(
    0,
    available -
      pixels(values.paddingLeft, defaults.paddingLeft) -
      pixels(values.paddingRight, defaults.paddingRight)
  );
  return pixels(values.width, defaults.width) > room
    ? { ...values, width: room }
    : values;
}

// The slot without which it is not sent — see ../manifest.js.
const required = requiredOf(manifest);

module.exports = {
  type: 'image',
  render,
  defaults,
  translatable,
  required,
  fitWidth,
};
