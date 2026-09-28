'use strict';

const _ = require('lodash');
const { userDeclarations, toPx, hasText } = require('../user-styles');
const { textOf } = require('../exported-content');
const { styleValue } = require('../colors');

// WCAG 1.4.12: a line height of at least 1.5 keeps lines apart for low-vision
// and dyslexic readers; justified text opens irregular gaps between words.
const MIN_LINE_HEIGHT = 1.5;
const DEFAULT_FONT_PX = 16;

const excerpt = (text) => (text.length > 40 ? `${text.slice(0, 40)}…` : text);

// The font size an element's text is drawn at, within the client's rich text.
function fontPxOf(element) {
  for (let el = element; el && el.nodeType === 1; el = el.parentElement) {
    const px = toPx(styleValue(el, 'font-size'));
    if (px) return px;
  }
  return DEFAULT_FONT_PX;
}

// A line height as a multiple of the font size, or null when unknown.
function lineHeightRatio(value, element) {
  const text = String(value).trim().toLowerCase();
  if (/^[\d.]+$/.test(text)) return Number(text);
  const percent = /^([\d.]+)%$/.exec(text);
  if (percent) return Number(percent[1]) / 100;
  const px = toPx(text);
  return px ? px / fontPxOf(element) : null;
}

module.exports = {
  id: 'text-layout',
  category: 'accessibility',
  severity: 'info',
  titleKey: 'Text layout',
  passKey: 'No text is justified or has tight lines',
  run(ctx) {
    const findings = userDeclarations(ctx)
      .filter(({ element }) => hasText(element))
      .map((decl) => {
        if (decl.prop === 'text-align' && /^justify/i.test(decl.value)) {
          return { ...decl, messageKey: 'Justified text: word gaps get harder to read: __text__' };
        }
        const ratio =
          decl.prop === 'line-height' && lineHeightRatio(decl.value, decl.element);
        if (ratio && ratio < MIN_LINE_HEIGHT) {
          return {
            ...decl,
            messageKey: 'Tight line height (__ratio__), under the 1.5 that keeps lines readable: __text__',
            params: { ratio: Math.round(ratio * 100) / 100 },
          };
        }
        return null;
      })
      .filter(Boolean);
    return _.uniqBy(findings, (f) => `${f.messageKey}|${f.path}`).map((f) => ({
      messageKey: f.messageKey,
      params: { ...f.params, text: excerpt(textOf(f.element)) },
      blockId: f.blockId,
      propertyPath: f.path,
      value: `${f.prop}:${f.value}`,
    }));
  },
};
