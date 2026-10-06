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

function decodeSrcTags(html) {
  return html.replace(
    srcRegexp,
    (match, tag) => `src="${decodeTag(match, tag)}"`
  );
}

function decodeHrefTags(html) {
  return html.replace(
    hrefRegexp,
    (match, tag) => `href="${decodeTag(match, tag)}"`
  );
}

const processMarkup = _.flow(secureHtml, decodeSrcTags, decodeHrefTags);

// A stylesheet is not markup, and goes through none of the above. Entities are
// not decoded inside <style> — `content:"→"` encoded as `&#8594;` shows the
// entity, and an accented font name no longer matches — and what looks like
// `src="…"` or `href="…"` in it is CSS text, which decoding would turn back
// into characters, inside an element the HTML parser ends at the first
// `</style`.
const STYLE_OPEN = /<style\b/gi;
const STYLE_CLOSE = /<\/style\s*>/gi;

/**
 * The document cut into markup and stylesheet parts, in order.
 *
 * One pass, each character read once: a `<style` that no `>` or `</style>`
 * ever closes ends the scan, and the rest is markup. A regex over the whole
 * element backtracked to the end of the input from every unclosed opening.
 *
 * @param {string} html
 * @returns {Array<{ css: boolean, text: string }>}
 */
function splitStylesheets(html) {
  const parts = [];
  let last = 0;
  STYLE_OPEN.lastIndex = 0;
  let open;
  while ((open = STYLE_OPEN.exec(html))) {
    const tagEnd = html.indexOf('>', open.index);
    if (tagEnd === -1) break;
    STYLE_CLOSE.lastIndex = tagEnd + 1;
    const close = STYLE_CLOSE.exec(html);
    if (!close) break;
    const end = close.index + close[0].length;
    parts.push({ css: false, text: html.slice(last, open.index) });
    parts.push({ css: true, text: html.slice(open.index, end) });
    last = end;
    STYLE_OPEN.lastIndex = end;
  }
  parts.push({ css: false, text: html.slice(last) });
  return parts;
}

function processOutsideStylesheets(html) {
  return splitStylesheets(html)
    .map((part) => (part.css ? part.text : processMarkup(part.text)))
    .join('');
}

const basicHtmlProcessing = _.flow(
  removeTinyMceExtraBrTag,
  replaceTabs,
  processOutsideStylesheets
);

module.exports = basicHtmlProcessing;
