'use strict';

// Text element.
//
// The markup follows what the Badsender templates already ship: a
// `role="presentation"` table with the three zeroed attributes, padding on the
// cell rather than margins on the paragraph, and the font stack repeated inline
// because most clients drop what is not on the element itself.
//
// `content` is RICH_TEXT: bold, italic, underline, links and line breaks pass
// through, everything else is dropped. That is an allow-list rebuild, not an
// escape — see rich-text.js.

const { defineTemplate } = require('../template.js');

const render = defineTemplate(
  [
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">',
    '<tr>',
    '<td align="[[align|ATTR|left]]"',
    ' style="padding:[[paddingTop|PX|0]]px [[paddingRight|PX|0]]px [[paddingBottom|PX|0]]px [[paddingLeft|PX|0]]px;',
    ' font-family:[[fontFamily|CSS_VALUE|Arial, Helvetica, sans-serif]];',
    ' font-size:[[fontSize|PX|14]]px;',
    ' line-height:[[lineHeight|PX|21]]px;',
    ' color:[[color|COLOR|#000000]];',
    ' mso-line-height-rule:exactly;">',
    '[[content|RICH_TEXT]]',
    '</td>',
    '</tr>',
    '</table>',
  ].join('')
);

// What the editor starts a new element with, and what the gallery renders.
const defaults = {
  content: '',
  align: 'left',
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontSize: 14,
  lineHeight: 21,
  color: '#000000',
  paddingTop: 8,
  paddingRight: 24,
  paddingBottom: 8,
  paddingLeft: 24,
};

module.exports = { type: 'text', render, defaults };
