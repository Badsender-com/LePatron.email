'use strict';

// See button.slots.js for what this file is and why the contexts live here.

module.exports = {
  // A LAYOUT, like column.slots.js: `cells` is markup the generator built from
  // the row's columns, never a value a user typed.
  kind: 'layout',

  slots: {
    cells: { context: 'MARKUP', default: '' },
  },
};
