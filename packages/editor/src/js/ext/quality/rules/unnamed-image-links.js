'use strict';

const { blockLinks } = require('../exported-content');
const { isUnfilled } = require('../links');
const { isPlaceholderSrc } = require('../images');

// A link made only of images, none of them with an alternative text: a screen
// reader announces it as "link" and nothing else. An image inside a link is
// never decorative, so an empty alt is always a problem here. Links still
// leading nowhere are reported by "images-without-link" instead, and a link
// around images never replaced by "unreplaced-images".
function hasName(anchor) {
  if ((anchor.getAttribute('aria-label') || '').trim()) return true;
  if ((anchor.getAttribute('title') || '').trim()) return true;
  return Array.from(anchor.querySelectorAll('img')).some((img) =>
    (img.getAttribute('alt') || '').trim()
  );
}

module.exports = {
  id: 'unnamed-image-links',
  category: 'accessibility',
  severity: 'warning',
  titleKey: 'Linked images',
  passKey: 'Every linked image has an alternative text',
  run(ctx) {
    const placeholderUrl = ctx.config.imagesUrl.placeholder;
    const hasRealImage = (anchor) =>
      Array.from(anchor.querySelectorAll('img')).some(
        (img) => !isPlaceholderSrc(img.getAttribute('src'), placeholderUrl)
      );
    return blockLinks(ctx)
      .filter(
        (link) =>
          !link.text &&
          !isUnfilled(link.href) &&
          hasRealImage(link.anchor) &&
          !hasName(link.anchor)
      )
      .map((link) => ({
        messageKey:
          'Linked image has no alternative text: screen readers announce a link with no name',
        blockId: link.blockId,
        value: link.href,
      }));
  },
};
