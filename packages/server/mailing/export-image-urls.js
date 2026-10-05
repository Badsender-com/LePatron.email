'use strict';

// The image URLs the export collects from a mailing's HTML to transfer them
// (mailing.service.js handleRelativeOrFtpImages). Only ever used with
// String.prototype.match, which resets `lastIndex`: global regexes are safe to
// share at module level.

// What a URL in the exported markup may hold: anything but whitespace, quotes,
// parentheses and tag brackets. One class for both regexes, so they stop at
// the same place. `;` is still allowed, as `&amp;` in a query string needs it.
const URL_CHARACTER = /[^\s"'()<>]/.source;

// Our own image endpoint, whatever the file extension. The extension-based
// regex below cannot match a file stored as `.bin` or `.false`, and those are
// precisely the ones that escaped the transfer in production.
// The host part stops at the same delimiters as the path: with `\S*`, a line
// of minified CSS matched from an earlier url() up to our `/api/images/`.
const OWN_IMAGES_URL_REGEX = new RegExp(
  `https?:\\/\\/${URL_CHARACTER}*\\/api\\/images\\/[^\\s"'<>)]+`,
  'g'
);

// Any image by its extension. `svg` was missing here: a perfectly well-named
// SVG was never collected, so it was never transferred, and the delivered
// email kept pointing at us. With `\S+` rather than URL_CHARACTER, minified CSS
// such as `url(https://x/a.png)}.b{background:url(https://x/b.png)}` matched
// from the first URL to the last extension, and the export's replace rewrote
// the CSS in between.
const IMAGE_FILE_URL_REGEX = new RegExp(
  `https?:${URL_CHARACTER}+\\.(jpg|jpeg|png|gif|webp|svg)`,
  'gi'
);

module.exports = { OWN_IMAGES_URL_REGEX, IMAGE_FILE_URL_REGEX };
