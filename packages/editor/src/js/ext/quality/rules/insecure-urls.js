'use strict';

const {
  blockLinks,
  blockImages,
  isPlatformImage,
} = require('../exported-content');

// Images the export transfers and rehosts (ZIP, CDN, FTP): every address with
// an image file extension, LePatron's or not. Recopied from
// packages/server/mailing/export-image-urls.js (IMAGE_FILE_URL_REGEX, read by
// mailing.service.js handleRelativeOrFtpImages): the editor bundle cannot
// require server code. Keep the two in step.
const REHOSTED_IMAGE = /^https?:[^\s"'()<>]+\.(jpg|jpeg|png|gif|webp|svg)/i;

const isHttp = (url) => Boolean(url) && url.protocol === 'http:';

// Plain http: a link warns the reader in some clients; an image may not load
// at all, since clients fetch images over https only. Only the images the
// export leaves in place are judged: a rehosted one (an image file, or one of
// LePatron's own backend) is served from wherever the export puts it. A merge
// tag in the query leaves the host readable: `http://brand.com/?u={{email}}`
// is judged, `http://{{domain}}/` is not.
module.exports = {
  id: 'insecure-urls',
  category: 'technical',
  severity: 'info',
  titleKey: 'Secure addresses',
  passKey: 'Every link and image uses https',
  run(ctx) {
    const links = blockLinks(ctx)
      .filter((link) => !link.dynamicHost && isHttp(link.url))
      .map((link) => ({
        messageKey: 'Link is not secure (http): __url__',
        params: { url: link.href },
        blockId: link.blockId,
        value: link.href,
      }));
    const images = blockImages(ctx)
      .filter(
        (image) =>
          !image.dynamicHost &&
          isHttp(image.url) &&
          !isPlatformImage(ctx, image.src) &&
          !REHOSTED_IMAGE.test(image.src)
      )
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
