'use strict';

const _ = require('lodash');
const { blockLinks, blockImages, isDynamic } = require('./exported-content');
const { isUnfilled } = require('./links');
const { isPlaceholderSrc } = require('./images');

// The links and images of the client's blocks that only the server can check
// (does the link answer, what does the image weigh once exported). Same bounds
// as the server, from packages/shared: past them, the first ones are checked
// and the rest left out, and a longer address is not sent at all.
const { RESOURCES } = require('../../../../../shared/quality/limits.js');

const MAX_LINKS = RESOURCES.maxLinks;
const MAX_IMAGES = RESOURCES.maxImages;
const MAX_URL_LENGTH = RESOURCES.maxUrlLength;

const isWeb = (url, raw) =>
  Boolean(url) &&
  (url.protocol === 'http:' || url.protocol === 'https:') &&
  raw.length <= MAX_URL_LENGTH;

/**
 * Links worth fetching: web addresses the client typed, merge tags excluded
 * (only the ESP knows where they lead), unfilled ones left to "unfilled-links".
 * A link dynamic in its query only (`https://brand.com/?id=%%ID%%`) is left
 * out as well: fetched with the tag as typed, the page answers for an id that
 * does not exist, and a "broken link" on it would be the check's mistake.
 */
function checkableLinks(ctx) {
  return blockLinks(ctx).filter(
    (link) =>
      !link.dynamic && !isUnfilled(link.href) && isWeb(link.url, link.href)
  );
}

/**
 * Images worth measuring: the client's, placeholders left to
 * "unreplaced-images", merge tags left out (only the ESP knows the address).
 */
function checkableImages(ctx) {
  const placeholderUrl = ctx.config.imagesUrl.placeholder;
  return blockImages(ctx).filter(
    (image) =>
      isWeb(image.url, image.src) &&
      !isDynamic(image.src) &&
      !isPlaceholderSrc(image.src, placeholderUrl)
  );
}

/**
 * What to ask the server about: the links only if one of the given checks
 * reads them, the images only if one reads them. A link sent for nothing is
 * still fetched by the server, and leaves the client's site a visit. The
 * checks themselves go along: the server runs only theirs (a link sent for
 * the blocklists is not visited when "broken-links" is off).
 * @param {Object} ctx
 * @param {Array<{ id: string, reads: string }>} rules - the server's checks
 *   that will run, each naming what it reads: 'links' or 'images'
 * @returns {{ links: string[], images: Array<{ url: string }>,
 *   checks: string[] }}
 */
function collectResources(ctx, rules) {
  const reads = new Set(rules.map((rule) => rule.reads));
  const links = reads.has('links')
    ? _.uniq(checkableLinks(ctx).map((link) => link.href))
    : [];
  const images = reads.has('images')
    ? _.uniq(checkableImages(ctx).map((image) => image.src))
    : [];
  return {
    links: links.slice(0, MAX_LINKS),
    images: images.slice(0, MAX_IMAGES).map((url) => ({ url })),
    checks: rules.map((rule) => rule.id),
  };
}

const hasResources = (resources) =>
  Boolean(resources) &&
  (resources.links.length > 0 || resources.images.length > 0);

// What the server said about one address, or null (not checked).
const remoteLink = (ctx, url) => _.get(ctx, ['remote', 'links', url], null);
const remoteImage = (ctx, url) => _.get(ctx, ['remote', 'images', url], null);

module.exports = {
  collectResources,
  hasResources,
  checkableLinks,
  checkableImages,
  remoteLink,
  remoteImage,
  MAX_LINKS,
  MAX_IMAGES,
};
