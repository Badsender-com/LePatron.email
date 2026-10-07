'use strict';

const { userDeclarations, toPx, hasText } = require('../user-styles');
const { textOf } = require('../exported-content');
const { thresholdOf } = require('../settings');

// The Badsender integration charter: 14 px minimum for body text. Only sizes
// the client set by hand are judged; the template's own sizes (a 12 px footer)
// are Badsender's choice. At 2 px and under, "hidden-text" reports it.
// Header and footer blocks (legal notice, view online) may go down to 12 px
// (team decision of 1 October 2026). Told apart by their block type:
// `headerBlock`, `preheaderBlock`, `footerBlock`, `footer-legal`… but not a
// content block such as `HeaderAndText`.
const HEADER_OR_FOOTER = /(?:header|footer)(?:[-_]?block)?$|^footer/i;
const HIDDEN_SIZE = 2;

const excerpt = (text) => (text.length > 40 ? `${text.slice(0, 40)}…` : text);

module.exports = {
  id: 'small-font',
  category: 'accessibility',
  severity: 'warning',
  titleKey: 'Font size',
  passKey:
    'No text was set under __min__ px, or __minHeaderFooter__ px in the header and footer',
  passParams: (ctx) => ({
    min: thresholdOf(ctx, 'small-font', 'minSize'),
    minHeaderFooter: thresholdOf(ctx, 'small-font', 'minSizeHeaderFooter'),
  }),
  HIDDEN_SIZE,
  run(ctx) {
    const types = new Map(ctx.blocks.map((block) => [block.id, block.type]));
    const minFor = (blockId) =>
      HEADER_OR_FOOTER.test(types.get(blockId) || '')
        ? thresholdOf(ctx, 'small-font', 'minSizeHeaderFooter')
        : thresholdOf(ctx, 'small-font', 'minSize');
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
