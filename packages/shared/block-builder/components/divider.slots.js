'use strict';

// See button.slots.js for what this file is and why the contexts live here.
//
// `width` is CSS_VALUE and not PX because a divider may be a percentage of its
// column ('50%') as readily as a pixel count.

module.exports = {
  slots: {
    color: { context: 'COLOR', fallback: '#cccccc' },
    thickness: { context: 'PX', fallback: '1' },
    width: { context: 'CSS_VALUE', fallback: '100%' },
    paddingTop: { context: 'PX', fallback: '8' },
    paddingRight: { context: 'PX', fallback: '24' },
    paddingBottom: { context: 'PX', fallback: '8' },
    paddingLeft: { context: 'PX', fallback: '24' },
  },
};
