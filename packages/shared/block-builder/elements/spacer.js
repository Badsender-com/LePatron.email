'use strict';

// Vertical spacer. The markup, and why the cell is built the way it is, is in
// components/spacer.vue; see index.js for how it gets here.

const { defineTemplate } = require('../template.js');
const { defaultsOf, translatableOf } = require('../manifest.js');

const render = defineTemplate(
  require('../components/spacer.compiled.js').default
);

const manifest = require('../components/spacer.slots.js');

// Typed as the generator expects — see ../manifest.js.
const defaults = defaultsOf(manifest);

// What a translation may rewrite — see ../manifest.js.
const translatable = translatableOf(manifest);

module.exports = { type: 'spacer', render, defaults, translatable };
