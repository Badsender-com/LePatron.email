'use strict';

const { blockImages, textOf } = require('../exported-content');

// An alternative text that repeats the text next to the image makes screen
// readers say it twice. Only a short caption-like text is compared: the alt
// must equal a whole element's text in the same block.
const normalize = (text) =>
  String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();

module.exports = {
  id: 'alt-redundant',
  category: 'accessibility',
  severity: 'info',
  titleKey: 'Repeated alternative texts',
  passKey: 'No alternative text repeats the text next to it',
  run(ctx) {
    return blockImages(ctx)
      .filter((image) => normalize(image.alt).length >= 3)
      .filter((image) => {
        const root = ctx.doc.getElementById(image.blockId);
        const alt = normalize(image.alt);
        return Array.from(root.querySelectorAll('p,h1,h2,h3,h4,h5,h6,a,span,td,div'))
          .filter((el) => !el.contains(image.img))
          .some((el) => normalize(textOf(el)) === alt);
      })
      .map((image) => ({
        messageKey: 'Alternative text repeats the text next to the image: __alt__',
        params: { alt: image.alt.trim() },
        blockId: image.blockId,
        value: image.alt,
      }));
  },
};
