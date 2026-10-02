'use strict';

const pathnameOf = (url) => {
  try {
    return new URL(url, 'http://placeholder.invalid').pathname;
  } catch (e) {
    return null;
  }
};

// The file name ends the only part of an image URL that survives the image
// backend: LePatron exports `${imagesUrl.cover}WxH/<file name>` whatever the
// image's original URL (convertedUrl, badsender-extensions.js).
const fileNameOf = (url) => {
  const name = url ? (pathnameOf(url) || '').split('/').pop() : '';
  try {
    return decodeURIComponent(name) || null;
  } catch (e) {
    return name || null;
  }
};

/**
 * An editable image left empty is exported as the image backend's placeholder,
 * or without any src. LePatron serves it under its own route
 * (`metadata.imagesUrl.placeholder`, e.g. /api/images/placeholder/300x360.png,
 * see badsender-extensions.js); stock Mosaico as `…?method=placeholder`.
 * Not the transparent GIF: that is a background "blank", and templates use it
 * as a spacer inside blocks.
 * @param {string|null} src
 * @param {string|null} [placeholderUrl] - the editor's placeholder route
 */
function isPlaceholderSrc(src, placeholderUrl) {
  if (!src) return true;
  if (/[?&]method=placeholder\b/.test(src)) return true;
  const placeholderPath = placeholderUrl && pathnameOf(placeholderUrl);
  // An src the URL parser rejects is the client's own mistake, not a
  // placeholder, and must not take the whole check down with it.
  const srcPath = placeholderPath && pathnameOf(src);
  return Boolean(srcPath) && srcPath.startsWith(placeholderPath);
}

module.exports = {
  fileNameOf,
  isPlaceholderSrc,
};
