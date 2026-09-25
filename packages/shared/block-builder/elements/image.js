'use strict';

// Image element.
//
// `display:block` kills the baseline gap clients leave under an inline image;
// `width` as an attribute AND in the style because Outlook reads the attribute
// and everything else reads the style; `max-width` plus `width:100%` so the
// image shrinks with its column instead of overflowing it.
//
// Two templates rather than one conditional: the engine renders slots, it does
// not branch. An image with no link must not ship an empty `<a>`, which some
// clients render as a focusable, underlined gap.
//
// The `src` is expected to come from the editor's gallery, which is what
// rewrites URLs for the CDN and the FTP export at download time. A free URL
// field would bypass that — a point for whoever wires the panel.

const { defineTemplate } = require('../template.js');

const IMG =
  '<img src="[[src|URL|]]" alt="[[alt|ATTR]]" width="[[width|PX|600]]"' +
  ' style="display:block; border:none; outline:none; text-decoration:none;' +
  ' width:100%; max-width:[[width|PX|600]]px; height:auto;" />';

const CELL_OPEN =
  '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">' +
  '<tr>' +
  '<td align="[[align|ATTR|center]]"' +
  ' style="padding:[[paddingTop|PX|0]]px [[paddingRight|PX|0]]px [[paddingBottom|PX|0]]px [[paddingLeft|PX|0]]px;">';

const CELL_CLOSE = '</td></tr></table>';

const renderPlain = defineTemplate(CELL_OPEN + IMG + CELL_CLOSE);

const renderLinked = defineTemplate(
  CELL_OPEN +
    '<a href="[[href|URL|#]]" target="_blank" style="text-decoration:none;">' +
    IMG +
    '</a>' +
    CELL_CLOSE
);

/**
 * @param {Object} [values]
 * @returns {string}
 */
function render(values) {
  const source = values || {};
  const href = typeof source.href === 'string' ? source.href.trim() : '';
  return href === '' ? renderPlain(source) : renderLinked(source);
}

// Both shapes, for the gallery and for tests that assert on either branch.
render.slots = renderLinked.slots;
render.variants = { plain: renderPlain, linked: renderLinked };

const defaults = {
  src: '',
  alt: '',
  href: '',
  width: 600,
  align: 'center',
  paddingTop: 0,
  paddingRight: 0,
  paddingBottom: 0,
  paddingLeft: 0,
};

module.exports = { type: 'image', render, defaults };
