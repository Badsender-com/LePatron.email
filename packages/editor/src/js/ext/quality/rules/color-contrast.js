'use strict';

const _ = require('lodash');
const { userDeclarations, hasText } = require('../user-styles');
const { textOf, excerpt } = require('../exported-content');
const { inherited, fontPxOf } = require('../inline-style');
const { parseColor, contrastRatio, backgroundOf } = require('../colors');
const { exportedElementOf } = require('../export-match');

// WCAG AA: 4.5:1 for body text, 3:1 for large text (24 px, or 18.66 px bold).
// Under 1.5:1 the text is as good as hidden, which filters distrust.
const AA_TEXT = 4.5;
const AA_LARGE = 3;
// AA is what is required; the message says AAA is the ideal (team decision
// of 1 October 2026).
const AAA_TEXT = 7;
const AAA_LARGE = 4.5;
const INVISIBLE = 1.5;

const colorOf = (element) => inherited(element, 'color', parseColor);

// Large text, by the size and weight the text is drawn at: read in the
// export, where the template's own size on the container shows (a 30 px bold
// title the client only coloured). A heading tag alone says nothing of
// weight: templates style them as they please.
function isLarge(element) {
  const px = fontPxOf(element) || 16;
  const weight = inherited(element, 'font-weight', (v) => v || null) || '';
  const bold =
    /^(bold|bolder|[6-9]00)$/i.test(weight) || !!element.closest('b,strong');
  return px >= 24 || (bold && px >= 18.66);
}

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
      .map(({ blockId, path, richText, element }) => {
        // The element as exported, inside the template's colours and sizes;
        // the rich text alone when the export does not show it.
        const shown = exportedElementOf(ctx, richText, element);
        const drawn = shown || ctx.doc.getElementById(blockId);
        if (!drawn) return null;
        // A background the client set under the template's text colour is
        // judged too: the colour is then the template's, read in the export.
        const color = colorOf(element) || (shown && colorOf(shown));
        const background =
          color &&
          (inherited(element, 'background-color', parseColor) ||
            backgroundOf(drawn));
        if (!color || !background) return null;
        const ratio = contrastRatio(color, background);
        const large = isLarge(shown || element);
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
