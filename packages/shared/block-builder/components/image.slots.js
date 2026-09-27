'use strict';

// See button.slots.js for what this file is and why the contexts live here.

module.exports = {
  slots: {
    src: { context: 'URL' },
    alt: { context: 'ATTR' },
    href: { context: 'URL', fallback: '#' },
    width: { context: 'PX', fallback: '600' },
    align: { context: 'ATTR', fallback: 'center' },
    paddingTop: { context: 'PX', fallback: '0' },
    paddingRight: { context: 'PX', fallback: '0' },
    paddingBottom: { context: 'PX', fallback: '0' },
    paddingLeft: { context: 'PX', fallback: '0' },
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
