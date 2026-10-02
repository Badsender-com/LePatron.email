'use strict';

// Call to action. The markup, and why it has no VML, is in
// components/button.vue; see index.js for how it gets here.

const { defineTemplate } = require('../template.js');
const { defaultsOf } = require('../manifest.js');

const render = defineTemplate(
  require('../components/button.compiled.js').default
);

// Typed as the generator expects — see ../manifest.js.
const defaults = defaultsOf(require('../components/button.slots.js'));

module.exports = { type: 'button', render, defaults };
