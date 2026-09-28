'use strict';

// Horizontal rule.
//
// A bordered cell rather than an `<hr>`: clients style `<hr>` inconsistently and
// several ignore its colour entirely. The border sits on a zero-height cell, so
// the line is exactly the thickness asked for.

const { defineTemplate } = require('../template.js');

const render = defineTemplate(
  [
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">',
    '<tr>',
    '<td style="padding:[[paddingTop|PX|8]]px [[paddingRight|PX|24]]px [[paddingBottom|PX|8]]px [[paddingLeft|PX|24]]px;">',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="[[width|CSS_VALUE|100%]]" align="center">',
    '<tr>',
    '<td style="border-top:[[thickness|PX|1]]px solid [[color|COLOR|#cccccc]];',
    ' font-size:0; line-height:0;">&nbsp;</td>',
    '</tr>',
    '</table>',
    '</td>',
    '</tr>',
    '</table>',
  ].join('')
);

const defaults = {
  color: '#cccccc',
  thickness: 1,
  width: '100%',
  paddingTop: 8,
  paddingRight: 24,
  paddingBottom: 8,
  paddingLeft: 24,
};

module.exports = { type: 'divider', render, defaults };
