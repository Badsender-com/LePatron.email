'use strict';

const _ = require('lodash');
const { allEditedRichTexts } = require('../user-styles');
const { textOf } = require('../exported-content');
const { styleValue, inherited } = require('../inline-style');
const { parseColor } = require('../colors');
const { exportedElementOf } = require('../export-match');

// A link inside a sentence, not underlined and of the same colour as the text
// around it: nothing tells it is a link, except to those who hover it. Only a
// link the client restyled (TinyMCE "link with colour") is judged; the colour
// of the text around it is most often the template's, read in the export.
const colorOf = (element) => inherited(element, 'color', parseColor);

const isUnderlined = (el) =>
  /underline/i.test(styleValue(el, 'text-decoration') || '');

// TinyMCE's "Underline" writes the line on a span inside the link.
const underlinedInside = (anchor) =>
  Boolean(anchor.querySelector('u')) ||
  Array.from(anchor.querySelectorAll('[style]')).some(isUnderlined);

module.exports = {
  id: 'indistinct-links',
  category: 'accessibility',
  severity: 'info',
  titleKey: 'Visible links',
  passKey: 'Every link stands out from the text around it',
  run(ctx) {
    return _.flatMap(allEditedRichTexts(ctx), (richText) =>
      Array.from(richText.root.querySelectorAll('a'))
        .filter((a) => {
          const decoration = styleValue(a, 'text-decoration') || '';
          if (!/none/i.test(decoration)) return false;
          if (!richText.isUserDeclaration('text-decoration', decoration)) {
            return false;
          }
          if (underlinedInside(a)) return false;
          // The text around the link, the rich text itself included: an
          // inline editable is a paragraph of its own.
          const parent = a.parentElement;
          const surrounding = textOf(parent).replace(textOf(a), '').trim();
          if (!surrounding) return false; // a lone link, like a button
          const shown = exportedElementOf(ctx, richText, a) || a;
          const linkColor = colorOf(shown);
          const textColor = colorOf(shown.parentElement);
          return linkColor && textColor && linkColor === textColor;
        })
        .map((a) => ({
          messageKey:
            'Link neither underlined nor coloured differently from its text: __label__',
          params: { label: textOf(a) },
          blockId: richText.blockId,
          propertyPath: richText.path,
          value: textOf(a),
        }))
    );
  },
};
