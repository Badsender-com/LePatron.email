'use strict';

// Text element. The markup is in components/text.vue; see index.js for how it
// gets here. `content` is RICH_TEXT: an allow-list rebuild, not an escape —
// see rich-text.js.

const { defineTemplate } = require('../template.js');
const { defaultsOf } = require('../manifest.js');

const render = defineTemplate(
  require('../components/text.compiled.js').default
);

// Typed as the generator expects — see ../manifest.js.
const defaults = defaultsOf(require('../components/text.slots.js'));

module.exports = { type: 'text', render, defaults };
