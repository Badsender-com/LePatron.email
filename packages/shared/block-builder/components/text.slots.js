'use strict';

// See button.slots.js for what this file is and why the contexts live here.

module.exports = {
  slots: {
    content: { context: 'RICH_TEXT' },
    align: { context: 'ATTR', fallback: 'left' },
    fontFamily: {
      context: 'CSS_VALUE',
      fallback: 'Arial, Helvetica, sans-serif',
    },
    fontSize: { context: 'PX', fallback: '14' },
    lineHeight: { context: 'PX', fallback: '21' },
    color: { context: 'COLOR', fallback: '#000000' },
    paddingTop: { context: 'PX', fallback: '0' },
    paddingRight: { context: 'PX', fallback: '0' },
    paddingBottom: { context: 'PX', fallback: '0' },
    paddingLeft: { context: 'PX', fallback: '0' },
  },
};
