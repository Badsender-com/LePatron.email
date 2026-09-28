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
// `fallback` is what the generator substitutes when a value is refused at
// render time (a `javascript:` href, a colour that is not one). It must be a
// string: it lands verbatim in the compiled template.
//
// A component whose markup branches also declares `variants` here — see
// image.slots.js. The button has one shape, so it has none.

module.exports = {
  slots: {
    label: { context: 'TEXT' },
    href: { context: 'URL', fallback: '#' },
    align: { context: 'ATTR', fallback: 'center' },
    backgroundColor: { context: 'COLOR', fallback: '#000000' },
    color: { context: 'COLOR', fallback: '#ffffff' },
    borderRadius: { context: 'PX', fallback: '4' },
    fontFamily: {
      context: 'CSS_VALUE',
      fallback: 'Arial, Helvetica, sans-serif',
    },
    fontSize: { context: 'PX', fallback: '16' },
    lineHeight: { context: 'PX', fallback: '20' },
    verticalPadding: { context: 'PX', fallback: '14' },
    horizontalPadding: { context: 'PX', fallback: '28' },
    paddingTop: { context: 'PX', fallback: '8' },
    paddingRight: { context: 'PX', fallback: '24' },
    paddingBottom: { context: 'PX', fallback: '8' },
    paddingLeft: { context: 'PX', fallback: '24' },
  },
};
