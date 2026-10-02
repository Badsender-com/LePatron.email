'use strict';

// See button.slots.js for what this file is and why the contexts live here.

module.exports = {
  slots: {
    content: { context: 'RICH_TEXT', default: '' },
    align: { context: 'ATTR', default: 'left' },
    fontFamily: {
      context: 'CSS_VALUE',
      default: 'Arial, Helvetica, sans-serif',
    },
    fontSize: { context: 'PX', default: 14 },
    lineHeight: { context: 'PX', default: 21 },
    color: { context: 'COLOR', default: '#000000' },
    paddingTop: { context: 'PX', default: 8 },
    paddingRight: { context: 'PX', default: 24 },
    paddingBottom: { context: 'PX', default: 8 },
    paddingLeft: { context: 'PX', default: 24 },
  },
};
