'use strict';

// Text element.
//
// The markup follows what the Badsender templates already ship: a
// `role="presentation"` table with the three zeroed attributes, padding on the
// cell rather than margins on the paragraph, and the font stack repeated inline
// because most clients drop what is not on the element itself.
//
// `content` is RICH_TEXT: bold, italic, underline, links and line breaks pass
// through, everything else is dropped. That is an allow-list rebuild, not an
// escape — see rich-text.js.

const { defineTemplate } = require('../template.js');
const { defaultsOf } = require('../manifest.js');

// The markup is not written here any more. It is compiled from
// components/text.vue by `yarn block-builder:compile`, so the people who own the
// email HTML can write it as a Vue component — the dialect they already use on
// client templates — instead of a string of placeholders.
//
// What arrives here is the same thing it always was: email HTML with typed
// `[[name|CONTEXT|fallback]]` holes. The engine, the escaping and the runtime
// are untouched; only the authoring moved.
const render = defineTemplate(
  require('../components/text.compiled.js').default
);

// Typed as the generator expects — see ../manifest.js.
const defaults = defaultsOf(require('../components/text.slots.js'));

module.exports = { type: 'text', render, defaults };
