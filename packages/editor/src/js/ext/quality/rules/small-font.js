'use strict';

const { userDeclarations, toPx, hasText } = require('../user-styles');
const { textOf } = require('../exported-content');

// The Badsender integration charter: 14 px minimum for body text. Only sizes
// the client set by hand are judged; the template's own sizes (a 12 px footer)
// are Badsender's choice. At 2 px and under, "hidden-text" reports it.
const MIN_SIZE = 14;
// Header and footer blocks (legal notice, view online) may go down to 12 px
// (team decision of 1 October 2026). Told apart by their block type.
const MIN_SIZE_HEADER_FOOTER = 12;
const HEADER_OR_FOOTER = /header|footer/i;
const HIDDEN_SIZE = 2;

const excerpt = (text) => (text.length > 40 ? `${text.slice(0, 40)}…` : text);

module.exports = {
  id: 'small-font',
  category: 'accessibility',
  severity: 'warning',
  titleKey: 'Font size',
  passKey: 'No text was set under 14 px, or 12 px in the header and footer',
  MIN_SIZE,
  MIN_SIZE_HEADER_FOOTER,
  HIDDEN_SIZE,
  run(ctx) {
    const types = new Map(ctx.blocks.map((block) => [block.id, block.type]));
    const minFor = (blockId) =>
      HEADER_OR_FOOTER.test(types.get(blockId) || '')
        ? MIN_SIZE_HEADER_FOOTER
        : MIN_SIZE;
    return userDeclarations(ctx)
      .filter(({ prop, element }) => prop === 'font-size' && hasText(element))
      .map((decl) => ({ ...decl, px: toPx(decl.value), min: minFor(decl.blockId) }))
      .filter(({ px, min }) => px !== null && px > HIDDEN_SIZE && px < min)
      .map(({ blockId, path, element, px, min }) => ({
        messageKey:
          'Text set to __size__ px, under the __min__ px that reads comfortably: __text__',
        params: {
          size: Math.round(px * 10) / 10,
          min,
          text: excerpt(textOf(element)),
        },
        blockId,
        propertyPath: path,
        value: `${px}|${textOf(element)}`,
      }));
  },
};
