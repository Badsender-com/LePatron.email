'use strict';

const _ = require('lodash');
const htmlEntities = require('he');
const decodeUriComponent = require('decode-uri-component');

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

// We don't want to manage any special format inside href now. We let the reponsability to users to decode
// themselves links in href (but only for href values) that's why we use this regex below
const hrefRegexp = /href="(.+?)"/g;

const srcRegexp = /src="(.+?)"/g;

const decodeTag = (match, tag, fun = (value) => value) => {
  let decodedTag = htmlEntities.decode(tag);
  try {
    decodedTag = decodeUriComponent(fun(decodedTag));
  } catch (err) {
    console.log('unable to decode URI', tag);
  }
  return decodedTag;
};

function decodeHrefTags(html) {
  return html.replace(
    hrefRegexp,
    (match, tag) => `href="${decodeTag(match, tag)}"`
  );
}

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
  decodeHrefTags,
  decodeSrcTags
);

module.exports = basicHtmlProcessing;
