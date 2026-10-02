'use strict';

// Horizontal rule. The markup, and why it is a bordered cell rather than an
// `<hr>`, is in components/divider.vue; see index.js for how it gets here.

const { defineTemplate } = require('../template.js');
const { defaultsOf } = require('../manifest.js');

const render = defineTemplate(
  require('../components/divider.compiled.js').default
);

// Typed as the generator expects — see ../manifest.js.
const defaults = defaultsOf(require('../components/divider.slots.js'));

module.exports = { type: 'divider', render, defaults };
