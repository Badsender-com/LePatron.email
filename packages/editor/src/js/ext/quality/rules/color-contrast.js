'use strict';

const _ = require('lodash');
const { userDeclarations, toPx, hasText } = require('../user-styles');
const { textOf } = require('../exported-content');
const { parseColor, contrastRatio, styleValue, backgroundOf } = require('../colors');

// WCAG AA: 4.5:1 for body text, 3:1 for large text (24 px, or 18.66 px bold).
// Under 1.5:1 the text is as good as hidden, which filters distrust.
const AA_TEXT = 4.5;
const AA_LARGE = 3;
// AA is what is required; the message says AAA is the ideal (team decision
// of 1 October 2026).
const AAA_TEXT = 7;
const AAA_LARGE = 4.5;
const INVISIBLE = 1.5;

// Within the client's rich text: the nearest declaration of a property.
function inherited(element, prop, parse) {
  for (let el = element; el && el.nodeType === 1; el = el.parentElement) {
    const value = parse(styleValue(el, prop));
    if (value) return value;
  }
  return null;
}

function isLarge(element) {
  const px = inherited(element, 'font-size', toPx) || 16;
  const bold = /^(bold|[6-9]00)$/i.test(
    inherited(element, 'font-weight', (v) => v || null) || ''
  ) || !!element.closest('b,strong,h1,h2,h3,h4,h5,h6');
  return px >= 24 || (bold && px >= 18.66);
}

// The background behind the client's text: declared in their rich text, or
// read from the export, from the element showing the same text in the block.
function backgroundFor(ctx, blockId, element) {
  const declared = inherited(element, 'background-color', parseColor);
  if (declared) return declared;
  const root = ctx.doc.getElementById(blockId);
  if (!root) return null;
  const text = textOf(element);
  const shown = Array.from(root.querySelectorAll('*')).find(
    (el) => textOf(el) === text && !Array.from(el.children).some((c) => textOf(c) === text)
  );
  return backgroundOf(shown || root);
}

const excerpt = (text) => (text.length > 40 ? `${text.slice(0, 40)}…` : text);

module.exports = {
  id: 'color-contrast',
  category: 'accessibility',
  severity: 'warning',
  titleKey: 'Colour contrast',
  passKey: 'Every coloured text reads against its background',
  run(ctx) {
    const coloured = userDeclarations(ctx).filter(
      ({ prop, element }) =>
        (prop === 'color' || prop === 'background-color') && hasText(element)
    );
    return _.uniqBy(coloured, 'element')
      .map(({ blockId, path, element }) => {
        const color = inherited(element, 'color', parseColor);
        const background = color && backgroundFor(ctx, blockId, element);
        if (!background) return null;
        const ratio = contrastRatio(color, background);
        const large = isLarge(element);
        const required = large ? AA_LARGE : AA_TEXT;
        if (ratio >= required) return null;
        const params = {
          ratio: Math.round(ratio * 10) / 10,
          required,
          ideal: large ? AAA_LARGE : AAA_TEXT,
          text: excerpt(textOf(element)),
        };
        return {
          messageKey:
            ratio < INVISIBLE
              ? 'Text almost invisible on its background (__ratio__:1): __text__'
              : 'Contrast too low (__ratio__:1): __required__:1 at least, __ideal__:1 ideally: __text__',
          severity: ratio < INVISIBLE ? 'error' : 'warning',
          params,
          blockId,
          propertyPath: path,
          value: `${color}|${background}|${params.text}`,
        };
      })
      .filter(Boolean);
  },
};
