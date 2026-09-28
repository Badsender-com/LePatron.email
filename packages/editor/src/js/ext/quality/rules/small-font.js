'use strict';

const { userDeclarations, toPx, hasText } = require('../user-styles');
const { textOf } = require('../exported-content');

// The Badsender integration charter: 14 px minimum for body text. Only sizes
// the client set by hand are judged; the template's own sizes (a 12 px footer)
// are Badsender's choice. At 2 px and under, "hidden-text" reports it.
const MIN_SIZE = 14;
const HIDDEN_SIZE = 2;

const excerpt = (text) => (text.length > 40 ? `${text.slice(0, 40)}…` : text);

module.exports = {
  id: 'small-font',
  category: 'accessibility',
  severity: 'warning',
  titleKey: 'Font size',
  passKey: 'No text was set under 14 px',
  MIN_SIZE,
  HIDDEN_SIZE,
  run(ctx) {
    return userDeclarations(ctx)
      .filter(({ prop, element }) => prop === 'font-size' && hasText(element))
      .map((decl) => ({ ...decl, px: toPx(decl.value) }))
      .filter(({ px }) => px !== null && px > HIDDEN_SIZE && px < MIN_SIZE)
      .map(({ blockId, path, element, px }) => ({
        messageKey: 'Text set to __size__ px, under the 14 px that reads comfortably: __text__',
        params: { size: Math.round(px * 10) / 10, text: excerpt(textOf(element)) },
        blockId,
        propertyPath: path,
        value: `${px}|${textOf(element)}`,
      }));
  },
};
