'use strict';

// Call to action.
//
// NO VML, on purpose, and it is the one debatable decision in this file.
//
// Forcing rounded corners on Outlook means a `v:roundrect`, and a `v:roundrect`
// needs its width in pixels — which locks the label. The Badsender design rules
// say it outright: "for translated, automated or heavily industrialised emails,
// prefer a button whose degradation to square corners is accepted over a locked
// label". A builder is industrialisation by definition, and a label the user
// retypes is the normal case here, so the button degrades to square corners on
// Outlook and keeps its width from its content everywhere.
//
// The rest is the bulletproof shape: background on the cell AND on the anchor,
// because Outlook paints the cell while the rest paint the padded inline-block;
// `bgcolor` next to the CSS for the clients that still read the attribute.
//
// Tap target: the default vertical padding plus the line height clears 44px, the
// minimum the design rules ask for.

const { defineTemplate } = require('../template.js');

const render = defineTemplate(
  [
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">',
    '<tr>',
    '<td align="[[align|ATTR|center]]"',
    ' style="padding:[[paddingTop|PX|8]]px [[paddingRight|PX|24]]px [[paddingBottom|PX|8]]px [[paddingLeft|PX|24]]px;">',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0">',
    '<tr>',
    '<td align="center" bgcolor="[[backgroundColor|COLOR|#000000]]"',
    ' style="background-color:[[backgroundColor|COLOR|#000000]];',
    ' border-radius:[[borderRadius|PX|4]]px;">',
    '<a href="[[href|URL|#]]" target="_blank"',
    ' style="display:inline-block;',
    ' padding:[[verticalPadding|PX|14]]px [[horizontalPadding|PX|28]]px;',
    ' font-family:[[fontFamily|CSS_VALUE|Arial, Helvetica, sans-serif]];',
    ' font-size:[[fontSize|PX|16]]px;',
    ' line-height:[[lineHeight|PX|20]]px;',
    ' color:[[color|COLOR|#ffffff]];',
    ' text-decoration:none;',
    ' border-radius:[[borderRadius|PX|4]]px;',
    ' mso-line-height-rule:exactly;">',
    '[[label|TEXT]]',
    '</a>',
    '</td>',
    '</tr>',
    '</table>',
    '</td>',
    '</tr>',
    '</table>',
  ].join('')
);

const defaults = {
  label: '',
  href: '',
  backgroundColor: '#000000',
  color: '#ffffff',
  borderRadius: 4,
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontSize: 16,
  lineHeight: 20,
  verticalPadding: 14,
  horizontalPadding: 28,
  align: 'center',
  paddingTop: 8,
  paddingRight: 24,
  paddingBottom: 8,
  paddingLeft: 24,
};

module.exports = { type: 'button', render, defaults };
