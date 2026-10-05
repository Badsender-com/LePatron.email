'use strict';

// What every prop of button.vue is allowed to be.
//
// This is where the security model lives now. In the hand-written templates the
// context travelled inside the placeholder (`[[color|COLOR|#000000]]`); a Vue
// SFC writes `{{ color }}` and has nowhere to put it, so it moves one step out —
// into this manifest, which the compiler reads to build the sentinels and to
// write the contexts back into the compiled template.
//
// The guarantee is unchanged, and it is the one that matters: a prop with no
// entry here has no context, and the compiler refuses to emit the component
// rather than guess. That is what stops the mistake that put an XSS in the
// March POC — a value reaching the output because somebody forgot a call.
//
// `default` is the value a new element starts with — a number for a PX slot, a
// string otherwise — and, written as a string, what the generator substitutes
// when a value is refused at render time (a size that is not one). `fallback`
// replaces it for that second use where the default would be wrong in the
// markup: an empty `href` links to the page itself. See ../manifest.js.
//
// A component whose markup branches also declares `variants` here — see
// image.slots.js. The button has one shape, so it has none.

module.exports = {
  slots: {
    label: { context: 'TEXT', default: '' },
    href: { context: 'URL', default: '', fallback: '#' },
    backgroundColor: { context: 'COLOR', default: '#000000' },
    color: { context: 'COLOR', default: '#ffffff' },
    borderRadius: { context: 'PX', default: 4 },
    fontFamily: {
      context: 'CSS_VALUE',
      default: 'Arial, Helvetica, sans-serif',
    },
    fontSize: { context: 'PX', default: 16 },
    lineHeight: { context: 'PX', default: 20 },
    verticalPadding: { context: 'PX', default: 14 },
    horizontalPadding: { context: 'PX', default: 28 },
    align: { context: 'ATTR', default: 'center' },
    paddingTop: { context: 'PX', default: 8 },
    paddingRight: { context: 'PX', default: 24 },
    paddingBottom: { context: 'PX', default: 8 },
    paddingLeft: { context: 'PX', default: 24 },
  },
};
