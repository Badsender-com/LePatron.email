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
    // Class names from the generator's closed list (generated-classes.js).
    classes: { context: 'ATTR', default: '' },
    // Half a gutter, normalised to whole px by row-spacing.js before it gets
    // here; PX would read anything else as its default.
    gutterLeft: { context: 'PX', default: 0 },
    gutterRight: { context: 'PX', default: 0 },
    // No default: the generator always fills it (see slot-contexts.js).
    content: { context: 'MARKUP' },
  },

  // A cell of a row of several columns stacks on a phone; the cell of a row of
  // one has nothing to stack, and no `class` attribute at all. A cell of a row
  // with a gutter is padded; one without carries no padding declaration.
  variants: {
    filled: { filled: true, stacks: true, padded: false },
    empty: { filled: false, stacks: true, padded: false },
    filledPadded: { filled: true, stacks: true, padded: true },
    emptyPadded: { filled: false, stacks: true, padded: true },
    filledAlone: { filled: true, stacks: false, padded: false },
    emptyAlone: { filled: false, stacks: false, padded: false },
  },
};
