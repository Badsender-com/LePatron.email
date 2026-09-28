'use strict';

const _ = require('lodash');
const { allEditedRichTexts } = require('../user-styles');
const { textOf } = require('../exported-content');
const { parseColor, styleValue } = require('../colors');

// A link inside a sentence, not underlined and of the same colour as the text
// around it: nothing tells it is a link, except to those who hover it. Only a
// link the client restyled (TinyMCE "link with colour") is judged.
function textColorOf(element, root) {
  for (let el = element; el && el !== root; el = el.parentElement) {
    const color = parseColor(styleValue(el, 'color'));
    if (color) return color;
  }
  return null;
}

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
          const parent = a.parentElement;
          const surrounding = textOf(parent).replace(textOf(a), '').trim();
          if (!surrounding) return false; // a lone link, like a button
          const linkColor = textColorOf(a, richText.root);
          const textColor = parent === richText.root ? null : textColorOf(parent, richText.root);
          return linkColor && textColor && linkColor === textColor;
        })
        .map((a) => ({
          messageKey: 'Link neither underlined nor coloured differently from its text: __label__',
          params: { label: textOf(a) },
          blockId: richText.blockId,
          propertyPath: richText.path,
          value: textOf(a),
        }))
    );
  },
};
