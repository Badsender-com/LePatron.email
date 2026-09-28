'use strict';

const { blockLinks, blockImages, isDynamic } = require('../exported-content');

const isHttp = (value) => /^http:\/\//i.test(value || '');

// Plain http: a link warns the reader in some clients; an image may not load
// at all, since clients fetch images over https only.
module.exports = {
  id: 'insecure-urls',
  category: 'technical',
  severity: 'info',
  titleKey: 'Secure addresses',
  passKey: 'Every link and image uses https',
  run(ctx) {
    const links = blockLinks(ctx)
      .filter((link) => !link.dynamic && isHttp(link.href))
      .map((link) => ({
        messageKey: 'Link is not secure (http): __url__',
        params: { url: link.href },
        blockId: link.blockId,
        value: link.href,
      }));
    const images = blockImages(ctx)
      .filter((image) => !isDynamic(image.src) && isHttp(image.src))
      .map((image) => ({
        messageKey: 'Image is not secure (http) and may not load: __url__',
        severity: 'warning',
        params: { url: image.src },
        blockId: image.blockId,
        value: image.src,
      }));
    return links.concat(images);
  },
};
