'use strict';

// Call to action. The markup, and why it has no VML, is in
// components/button.vue; see index.js for how it gets here.

const { defineTemplate } = require('../template.js');
const { defaultsOf, translatableOf, requiredOf } = require('../manifest.js');

const render = defineTemplate(
  require('../components/button.compiled.js').default
);

const manifest = require('../components/button.slots.js');

// Typed as the generator expects — see ../manifest.js.
const defaults = defaultsOf(manifest);

// What a translation may rewrite — see ../manifest.js.
const translatable = translatableOf(manifest);

// The slot without which it is not sent — see ../manifest.js.
const required = requiredOf(manifest);

module.exports = { type: 'button', render, defaults, translatable, required };
