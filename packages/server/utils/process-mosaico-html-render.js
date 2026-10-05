'use strict';

const _ = require('lodash');
const htmlEntities = require('he');

// Tiny MCE can add some not wanted <BR> tags
// • this can break up a layout on email clients
//   https://github.com/Badsender/mosaico/issues/1
// → remove them
//   don't use Cheerio because:
//   • when exporting it's messing with ESP tags
//   • Cheerio won't handle IE comments
function removeTinyMceExtraBrTag(html) {
  return html.replace(/<br\sdata-mce-bogus="1">/g, '');
}

// replace all tabs by spaces so `he` don't replace them by `&#x9;`
// `he` is an HTML entity encoder/decoder
function replaceTabs(html) {
  return html.replace(/\t/g, ' ');
}

// encode what we can to HTML entities
// → better for mailing
function secureHtml(html) {
  return htmlEntities.encode(html, {
    useNamedReferences: false,
    decimal: true,
    allowUnsafeSymbols: true,
  });
}

const srcRegexp = /src="(.+?)"/g;
const hrefRegexp = /href="(.+?)"/g;

const decodeTag = (match, tag) => {
  return htmlEntities.decode(tag);
};

// A stylesheet is not markup: what looks like `src="…"` or `href="…"` in it is
// CSS text (a comment, a string, a selector), and decoding it would turn the
// entities `secureHtml` just wrote back into the characters they stand for —
// inside an element the HTML parser ends at the first `</style`.
const STYLE_ELEMENT = /<style\b[^>]*>[\s\S]*?<\/style\s*>/gi;

/**
 * Applies `transform` to the document everywhere but inside <style> elements.
 *
 * @param {string} html
 * @param {Function} transform string -> string
 * @returns {string}
 */
function outsideStylesheets(html, transform) {
  let result = '';
  let last = 0;
  html.replace(STYLE_ELEMENT, (element, offset) => {
    result += transform(html.slice(last, offset)) + element;
    last = offset + element.length;
    return element;
  });
  return result + transform(html.slice(last));
}

function decodeSrcTags(html) {
  return outsideStylesheets(html, (part) =>
    part.replace(srcRegexp, (match, tag) => `src="${decodeTag(match, tag)}"`)
  );
}

function decodeHrefTags(html) {
  return outsideStylesheets(html, (part) =>
    part.replace(hrefRegexp, (match, tag) => `href="${decodeTag(match, tag)}"`)
  );
}

const basicHtmlProcessing = _.flow(
  removeTinyMceExtraBrTag,
  replaceTabs,
  secureHtml,
  decodeSrcTags,
  decodeHrefTags
);

module.exports = basicHtmlProcessing;
