'use strict';

// Call to action.
//
// NO VML, on purpose, and it is the one debatable decision in this file.
//
// Forcing rounded corners on Outlook means a `v:roundrect`, and a `v:roundrect`
// needs its width in pixels — which locks the label. The Badsender design rules
// say it outright: "for translated, automated or heavily industrialised emails,
// prefer a button whose degradation to square corners is accepted over a locked
// label". A builder is industrialisation by definition, and a label the user
// retypes is the normal case here, so the button degrades to square corners on
// Outlook and keeps its width from its content everywhere.
//
// The rest is the bulletproof shape: background on the cell AND on the anchor,
// because Outlook paints the cell while the rest paint the padded inline-block;
// `bgcolor` next to the CSS for the clients that still read the attribute.
//
// Tap target: the default vertical padding plus the line height clears 44px, the
// minimum the design rules ask for.

const { defineTemplate } = require('../template.js');

// The markup is not written here any more. It is compiled from
// components/button.vue by `yarn block-builder:compile`, so the people who own
// the email HTML can write it as a Vue component with Tailwind classes — the
// dialect they already use on client templates — instead of a string of
// placeholders.
//
// What arrives here is the same thing it always was: email HTML with typed
// `[[name|CONTEXT|fallback]]` holes. The engine, the escaping and the runtime
// are untouched; only the authoring moved.
const render = defineTemplate(
  require('../components/button.compiled.js').default
);

const defaults = {
  label: '',
  href: '',
  backgroundColor: '#000000',
  color: '#ffffff',
  borderRadius: 4,
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontSize: 16,
  lineHeight: 20,
  verticalPadding: 14,
  horizontalPadding: 28,
  align: 'center',
  paddingTop: 8,
  paddingRight: 24,
  paddingBottom: 8,
  paddingLeft: 24,
};

module.exports = { type: 'button', render, defaults };
