'use strict'

const _ = require('lodash')
const htmlEntities = require('he')
const decodeUriComponent = require('decode-uri-component')

// Tiny MCE can add some not wanted <BR> tags
// • this can break up a layout on email clients
//   https://github.com/Badsender/mosaico/issues/1
// → remove them
//   don't use Cheerio because:
//   • when exporting it's messing with ESP tags
//   • Cheerio won't handle IE comments
function removeTinyMceExtraBrTag(html) {
  return html.replace(/<br\sdata-mce-bogus="1">/g, ``)
}

// replace all tabs by spaces so `he` don't replace them by `&#x9;`
// `he` is an HTML entity encoder/decoder
function replaceTabs(html) {
  return html.replace(/\t/g, ` `)
}

// encode what we can to HTML entities
// → better for mailing
function secureHtml(html) {
  return htmlEntities.encode(html, {
    useNamedReferences: true,
    allowUnsafeSymbols: true,
  })
}

// selligent tags between “href” or “src” are encoded at the export
// • we need to reverse the operation to keep them OK
// use another decodeUriComponent instead of native
// • native had problems de-encoding selligent tags
//   due to date format %d%m%Y
// • (FORMATDATETIME(GETDATE(),%20%27%d%m%Y%27))
const selligentTagRegexp = /~([^~]+)~/g
const decodeSelligentTag = (match, tag) => {
  let decodedTag = htmlEntities.decode(tag)
  try {
    decodedTag = decodeUriComponent(decodedTag)
  } catch (err) {
    console.log(`unable to decode URI`, tag)
  }
  return `~${decodedTag}~`
}
function decodeSelligentTags(html) {
  html = html.replace(selligentTagRegexp, decodeSelligentTag)
  return html
}

const basicHtmlProcessing = _.flow(
  removeTinyMceExtraBrTag,
  replaceTabs,
  secureHtml,
  decodeSelligentTags,
)

module.exports = basicHtmlProcessing
