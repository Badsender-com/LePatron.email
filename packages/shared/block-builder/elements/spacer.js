'use strict';

// Vertical spacer.
//
// A cell with an explicit height, plus `font-size:0` and `line-height:0`: without
// those, Outlook gives the non-breaking space a line box of its own and the gap
// comes out taller than asked. The `&nbsp;` itself is what stops clients from
// collapsing an empty cell altogether.

const { defineTemplate } = require('../template.js');

// The markup is not written here any more. It is compiled from
// components/spacer.vue by `yarn block-builder:compile`, so the people who own the
// email HTML can write it as a Vue component — the dialect they already use on
// client templates — instead of a string of placeholders.
//
// What arrives here is the same thing it always was: email HTML with typed
// `[[name|CONTEXT|fallback]]` holes. The engine, the escaping and the runtime
// are untouched; only the authoring moved.
const render = defineTemplate(
  require('../components/spacer.compiled.js').default
);

const defaults = { height: 24 };

module.exports = { type: 'spacer', render, defaults };
