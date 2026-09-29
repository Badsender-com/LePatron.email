'use strict';

const _ = require('lodash');
const { blockLinks, blockImages, isDynamic } = require('./exported-content');
const { isUnfilled } = require('./rules/unfilled-links');
const { isPlaceholderSrc } = require('./rules/unreplaced-images');

// The links and images of the client's blocks that only the server can check
// (does the link answer, what does the image weigh once exported). Same bounds
// as the server (quality-resources.service.js): past them, the first ones are
// checked and the rest left out.
const MAX_LINKS = 60;
const MAX_IMAGES = 40;
// Longer addresses are refused by the server, which would fail the whole run.
const MAX_URL_LENGTH = 2048;

const isWeb = (url, raw) =>
  Boolean(url) &&
  (url.protocol === 'http:' || url.protocol === 'https:') &&
  raw.length <= MAX_URL_LENGTH;

/**
 * Links worth fetching: web addresses the client typed, merge tags excluded
 * (only the ESP knows where they lead), unfilled ones left to "unfilled-links".
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
  const placeholderUrl = _.get(ctx.viewModel, 'metadata.imagesUrl.placeholder');
  return blockImages(ctx).filter(
    (image) =>
      isWeb(image.url, image.src) &&
      !isDynamic(image.src) &&
      !isPlaceholderSrc(image.src, placeholderUrl)
  );
}

/**
 * What to ask the server about.
 * @returns {{ links: string[], images: Array<{ url: string }> }}
 */
function collectResources(ctx) {
  const links = _.uniq(checkableLinks(ctx).map((link) => link.href));
  const images = _.uniq(checkableImages(ctx).map((image) => image.src));
  return {
    links: links.slice(0, MAX_LINKS),
    images: images.slice(0, MAX_IMAGES).map((url) => ({ url })),
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
