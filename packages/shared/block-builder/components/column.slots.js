'use strict';

// See button.slots.js for what this file is and why the contexts live here.

module.exports = {
  // A LAYOUT, not an element. This is what lets `content` declare MARKUP, the
  // one context that does not escape — and the compiler refuses that context
  // anywhere else. A layout's slots are filled by the generator with its own
  // output; an element's are filled from what a user typed.
  kind: 'layout',

  slots: {
    // `50%` or `50.1667%`, already formatted: the cell's share of the block,
    // for the style.
    width: { context: 'CSS_VALUE', default: '100%' },
    // The same width for the attribute Outlook reads: the percentage, or the
    // cell's px when the row has a width that is not a whole percentage.
    // CSS_VALUE, not PX: it may carry a `%`.
    widthAttribute: { context: 'CSS_VALUE', default: '100%' },
    // Class names from the generator's closed list (generated-classes.js).
    classes: { context: 'ATTR', default: '' },
    // The gutter before the cell, normalised to whole px by row-spacing.js
    // before it gets here; PX would read anything else as its default.
    gutter: { context: 'PX', default: 0 },
    // No default: the generator always fills it (see slot-contexts.js).
    content: { context: 'MARKUP' },
  },

  // A cell of a row of several columns stacks on a phone; the cell of a row of
  // one has nothing to stack, and no `class` attribute at all. A cell with a
  // gutter before it is padded; one without carries no padding declaration.
  variants: {
    filled: { filled: true, stacks: true, padded: false },
    empty: { filled: false, stacks: true, padded: false },
    filledPadded: { filled: true, stacks: true, padded: true },
    emptyPadded: { filled: false, stacks: true, padded: true },
    filledAlone: { filled: true, stacks: false, padded: false },
    emptyAlone: { filled: false, stacks: false, padded: false },
  },
};
