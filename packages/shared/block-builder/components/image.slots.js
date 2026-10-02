'use strict';

// See button.slots.js for what this file is and why the contexts live here.

module.exports = {
  slots: {
    src: { context: 'URL', default: '' },
    alt: { context: 'ATTR', default: '' },
    href: { context: 'URL', default: '', fallback: '#' },
    width: { context: 'PX', default: 600 },
    align: { context: 'ATTR', default: 'center' },
    paddingTop: { context: 'PX', default: 0 },
    paddingRight: { context: 'PX', default: 0 },
    paddingBottom: { context: 'PX', default: 0 },
    paddingLeft: { context: 'PX', default: 0 },
  },

  // Two shapes, resolved here rather than at render time. `href` only exists in
  // the linked one, which is exactly why the compiler tolerates a slot that a
  // given variant does not render — while still refusing one that NO variant
  // renders.
  variants: {
    plain: { linked: false },
    linked: { linked: true },
  },
};
