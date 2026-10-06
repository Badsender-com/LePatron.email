'use strict';

const _ = require('lodash');
const { userDeclarations, toPx, hasText } = require('../user-styles');
const { textOf } = require('../exported-content');
const { styleValue } = require('../colors');

// Justified text opens irregular gaps between words. A line height under 1
// makes lines overlap: that is what is reported (team decision of 1 October
// 2026). WCAG asks for 1.5 at AAA only, and whether 1.2 reads well depends on
// the template and its typeface.
const MIN_LINE_HEIGHT = 1;
// Centred text is hard to follow past about three lines: some 200 characters
// at the width of an email. Said once for the whole email, with no block to
// go to: centred titles and short lines are fine, and pointing at each one
// would bury the advice.
const CENTRED_MAX_CHARS = 200;

const excerpt = (text) => (text.length > 40 ? `${text.slice(0, 40)}…` : text);

// The font size an element's text is drawn at, within the client's rich
// text; null when only the template knows it.
function fontPxOf(element) {
  for (let el = element; el && el.nodeType === 1; el = el.parentElement) {
    const px = toPx(styleValue(el, 'font-size'));
    if (px) return px;
  }
  return null;
}

// A line height as a multiple of the font size, or null when unknown. A line
// height in px or pt is only judged against a font size the client set: the
// template's own size (a 12 px footer) is out of sight, and guessing 16 px
// would report lines that do not overlap.
function lineHeightRatio(value, element) {
  const text = String(value).trim().toLowerCase();
  if (/^[\d.]+$/.test(text)) return Number(text);
  const percent = /^([\d.]+)%$/.exec(text);
  if (percent) return Number(percent[1]) / 100;
  const px = toPx(text);
  const fontPx = fontPxOf(element);
  return px !== null && fontPx ? px / fontPx : null;
}

const isCentred = (value) => /^center/i.test(String(value || '').trim());

// The length of the text that is drawn centred by this element: its own text
// and its children's, except those that set an alignment of their own.
function centredLength(element) {
  let length = 0;
  element.childNodes.forEach((node) => {
    if (node.nodeType === 3) length += node.textContent.trim().length;
    else if (node.nodeType === 1) {
      const align = styleValue(node, 'text-align');
      if (!align || isCentred(align)) length += centredLength(node);
    }
  });
  return length;
}

module.exports = {
  id: 'text-layout',
  category: 'accessibility',
  severity: 'info',
  titleKey: 'Text layout',
  passKey: 'No text is justified, overlaps or is centred at length',
  CENTRED_MAX_CHARS,
  run(ctx) {
    const declarations = userDeclarations(ctx).filter(({ element }) =>
      hasText(element)
    );
    const longCentred = declarations.some(
      ({ prop, value, element }) =>
        prop === 'text-align' &&
        isCentred(value) &&
        centredLength(element) > CENTRED_MAX_CHARS
    );
    const findings = declarations
      .map((decl) => {
        if (decl.prop === 'text-align' && /^justify/i.test(decl.value)) {
          return { ...decl, messageKey: 'Justified text: word gaps get harder to read: __text__' };
        }
        const ratio =
          decl.prop === 'line-height' && lineHeightRatio(decl.value, decl.element);
        if (typeof ratio === 'number' && ratio < MIN_LINE_HEIGHT) {
          return {
            ...decl,
            messageKey: 'Line height under 1 (__ratio__): the lines overlap: __text__',
            severity: 'warning',
            params: { ratio: Math.round(ratio * 100) / 100 },
          };
        }
        return null;
      })
      .filter(Boolean);
    const perBlock = _.uniqBy(findings, (f) => `${f.messageKey}|${f.path}`).map(
      (f) => ({
        messageKey: f.messageKey,
        severity: f.severity,
        params: { ...f.params, text: excerpt(textOf(f.element)) },
        blockId: f.blockId,
        propertyPath: f.path,
        value: `${f.prop}:${f.value}`,
      })
    );
    if (!longCentred) return perBlock;
    return perBlock.concat({
      messageKey:
        'Centred text over about three lines is hard to read: align long texts to the left',
      // One advice for the whole email: ignoring it keeps it ignored.
      value: 'long-centred-text',
    });
  },
};
