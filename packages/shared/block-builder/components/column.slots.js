'use strict';

// See button.slots.js for what this file is and why the contexts live here.

module.exports = {
  // A LAYOUT, not an element. This is what lets `content` declare MARKUP, the
  // one context that does not escape — and the compiler refuses that context
  // anywhere else. A layout's slots are filled by the generator with its own
  // output; an element's are filled from what a user typed.
  kind: 'layout',

  slots: {
    // `50%`, already formatted. CSS_VALUE and not ATTR because the same value
    // lands in both the `width` attribute and the inline style — Outlook reads
    // the attribute, everything else reads the style — and a slot has to
    // satisfy every position it fills. PX would strip the unit.
    width: { context: 'CSS_VALUE', default: '100%' },
    stackClass: { context: 'ATTR', default: '' },
    content: { context: 'MARKUP', default: '' },
  },

  variants: {
    filled: { filled: true },
    empty: { filled: false },
  },
};
