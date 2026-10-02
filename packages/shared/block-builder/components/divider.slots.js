'use strict';

// See button.slots.js for what this file is and why the contexts live here.
//
// `width` is CSS_VALUE and not PX because a divider may be a percentage of its
// column ('50%') as readily as a pixel count.

module.exports = {
  slots: {
    color: { context: 'COLOR', default: '#cccccc' },
    thickness: { context: 'PX', default: 1 },
    width: { context: 'CSS_VALUE', default: '100%' },
    paddingTop: { context: 'PX', default: 8 },
    paddingRight: { context: 'PX', default: 24 },
    paddingBottom: { context: 'PX', default: 8 },
    paddingLeft: { context: 'PX', default: 24 },
  },
};
