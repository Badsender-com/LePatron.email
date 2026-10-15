'use strict';

const _ = require('lodash');
const { allEditedRichTexts } = require('../user-styles');
const { textOf } = require('../exported-content');

// Screen reader users jump from heading to heading: an empty heading is a
// dead stop, a skipped level (h2 then h4) a missing step. Judged within each
// rich text the client wrote; the template's own heading outline is its own.
// An image with an alternative text names a heading as well as words do.
const nameOf = (heading) =>
  textOf(heading) ||
  Array.from(heading.querySelectorAll('img[alt]'))
    .map((img) => img.getAttribute('alt').trim())
    .find(Boolean) ||
  '';

module.exports = {
  id: 'headings',
  category: 'accessibility',
  severity: 'info',
  titleKey: 'quality-title-headings',
  passKey: 'Headings are filled in and follow each other',
  run(ctx) {
    return _.flatMap(allEditedRichTexts(ctx), (richText) => {
      const headings = Array.from(
        richText.root.querySelectorAll('h1,h2,h3,h4,h5,h6')
      );
      const finding = (messageKey, params, value) => ({
        messageKey,
        params,
        blockId: richText.blockId,
        propertyPath: richText.path,
        value,
      });
      return headings
        .map((heading, i) => {
          const level = Number(heading.tagName[1]);
          if (!nameOf(heading)) {
            return finding(
              'Empty heading (__tag__)',
              { tag: heading.tagName.toLowerCase() },
              `empty-${i}`
            );
          }
          const previous = headings[i - 1];
          const previousLevel = previous && Number(previous.tagName[1]);
          if (previousLevel && level > previousLevel + 1) {
            return finding(
              'Heading level skipped: __from__ followed by __to__',
              { from: `h${previousLevel}`, to: `h${level}` },
              `${previousLevel}-${level}-${nameOf(heading)}`
            );
          }
          return null;
        })
        .filter(Boolean);
    });
  },
};
