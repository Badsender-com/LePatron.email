'use strict';

// Vertical spacer. The markup, and why the cell is built the way it is, is in
// components/spacer.vue; see index.js for how it gets here.

const { defineTemplate } = require('../template.js');
const { defaultsOf } = require('../manifest.js');

const render = defineTemplate(
  require('../components/spacer.compiled.js').default
);

// Typed as the generator expects — see ../manifest.js.
const defaults = defaultsOf(require('../components/spacer.slots.js'));

module.exports = { type: 'spacer', render, defaults };
