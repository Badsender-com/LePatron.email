'use strict';

// Horizontal rule.
//
// A bordered cell rather than an `<hr>`: clients style `<hr>` inconsistently and
// several ignore its colour entirely. The border sits on a zero-height cell, so
// the line is exactly the thickness asked for.

const { defineTemplate } = require('../template.js');
const { defaultsOf } = require('../manifest.js');

// The markup is not written here any more. It is compiled from
// components/divider.vue by `yarn block-builder:compile`, so the people who own the
// email HTML can write it as a Vue component — the dialect they already use on
// client templates — instead of a string of placeholders.
//
// What arrives here is the same thing it always was: email HTML with typed
// `[[name|CONTEXT|fallback]]` holes. The engine, the escaping and the runtime
// are untouched; only the authoring moved.
const render = defineTemplate(
  require('../components/divider.compiled.js').default
);

// Typed as the generator expects — see ../manifest.js.
const defaults = defaultsOf(require('../components/divider.slots.js'));

module.exports = { type: 'divider', render, defaults };
