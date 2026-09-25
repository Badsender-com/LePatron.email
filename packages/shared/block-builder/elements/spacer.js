'use strict';

// Vertical spacer.
//
// A cell with an explicit height, plus `font-size:0` and `line-height:0`: without
// those, Outlook gives the non-breaking space a line box of its own and the gap
// comes out taller than asked. The `&nbsp;` itself is what stops clients from
// collapsing an empty cell altogether.

const { defineTemplate } = require('../template.js');

const render = defineTemplate(
  [
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">',
    '<tr>',
    '<td height="[[height|PX|24]]"',
    ' style="height:[[height|PX|24]]px; font-size:0; line-height:0;"',
    ' aria-hidden="true">&nbsp;</td>',
    '</tr>',
    '</table>',
  ].join('')
);

const defaults = { height: 24 };

module.exports = { type: 'spacer', render, defaults };
