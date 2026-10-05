'use strict';

// Horizontal rule. The markup, and why it is a bordered cell rather than an
// `<hr>`, is in components/divider.vue; see index.js for how it gets here.

const { defineTemplate } = require('../template.js');
const { defaultsOf, translatableOf } = require('../manifest.js');

const render = defineTemplate(
  require('../components/divider.compiled.js').default
);

const manifest = require('../components/divider.slots.js');

// Typed as the generator expects — see ../manifest.js.
const defaults = defaultsOf(manifest);

// What a translation may rewrite — see ../manifest.js.
const translatable = translatableOf(manifest);

module.exports = { type: 'divider', render, defaults, translatable };
