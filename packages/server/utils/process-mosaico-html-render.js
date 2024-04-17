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

const decodeTag = (match, tag) => {
  return htmlEntities.decode(tag);
};

function decodeSrcTags(html) {
  return html.replace(
    srcRegexp,
    (match, tag) => `src="${decodeTag(match, tag)}"`
  );
}

const basicHtmlProcessing = _.flow(
  removeTinyMceExtraBrTag,
  replaceTabs,
  secureHtml,
  decodeSrcTags
);

module.exports = basicHtmlProcessing;
