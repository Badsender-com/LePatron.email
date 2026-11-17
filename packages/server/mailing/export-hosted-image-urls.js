'use strict';

// Once its images are hosted, the export rewrites each of them from a map of
// its relative path to its hosted URL (mailing.service.js). The FTP and CDN
// exports fill the map from their endpoint; an image host fills it with the
// URLs it returns, which its file names do not predict (ADR 0028).

const _ = require('lodash');

const IMAGES_FOLDER = 'images';

/**
 * The path the export first gives an image while collecting it, before it is
 * hosted: what the ZIP of a regular download keeps.
 * @param {string} imageName
 * @returns {string}
 */
function relativeImagePath(imageName) {
  return `${IMAGES_FOLDER}/${imageName}`;
}

/**
 * Where the FTP and CDN exports put the images of an email: in a folder named
 * after it, under the endpoint.
 * @param {Object} params
 * @param {string} params.endpointBase protocol and endpoint
 * @param {string} params.folderName the email's folder
 * @param {string[]} params.imageNames
 * @returns {{ hostedUrls: Map<string, string>, endpointPath: string }}
 */
function hostedUrlsUnderEndpoint({ endpointBase, folderName, imageNames }) {
  const endpointPath = `${endpointBase.replace(/\/$/, '')}/${folderName}`;
  const hostedUrls = new Map(
    imageNames.map((imageName) => [
      relativeImagePath(imageName),
      `${endpointPath}/${imageName}`,
    ])
  );
  return { hostedUrls, endpointPath };
}

/**
 * The HTML with each relative image path replaced by its hosted URL.
 * @param {string} html
 * @param {Map<string, string>} hostedUrls relative path → hosted URL
 * @returns {string}
 */
function rewriteHostedImages(html, hostedUrls) {
  if (hostedUrls.size === 0) return html;
  // One pass: a hosted URL holding `images/<another name>` is not rewritten
  // again. Escaped: an image named `hero(1).png` opened a regex group and was
  // never rewritten. Longest first, so `images/a.png` does not take the
  // start of `images/a.png.webp`. A function as replacement, so that a `$`
  // in the URL is not read as a back-reference.
  const paths = [...hostedUrls.keys()].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(paths.map(_.escapeRegExp).join('|'), 'g');
  return html.replace(pattern, (relativePath) => hostedUrls.get(relativePath));
}

module.exports = {
  IMAGES_FOLDER,
  relativeImagePath,
  hostedUrlsUnderEndpoint,
  rewriteHostedImages,
};
