'use strict';

const _ = require('lodash');
const url = require('url');
const getSlug = require('speakingurl');

function getName(name) {
  name = name || 'email';
  return getSlug(name.replace(/\.[0-9a-z]+$/, ''));
}

function getImageName(imageUrl) {
  // eslint-disable-next-line node/no-deprecated-api
  const formattedUrlName = url
    .parse(imageUrl)
    .pathname.replace(/\//g, ' ')
    .trim()
    .replace(/\s/g, '-');

  const splittedUrlName = formattedUrlName.split('-');
  let fileName = '';

  const coverPart = splittedUrlName[2] || '';

  // Test if old file name contains a cover value
  if (coverPart.includes('cover')) {
    fileName = fileName.concat(coverPart);
  }

  const sizePart = splittedUrlName[3] || '';

  // Test if old file name contains a size value
  const isSizePart = sizePart.match(/\d{1,5}x/g);

  if (isSizePart && isSizePart[0] !== undefined) {
    fileName = fileName.concat('-', sizePart);
  }

  // Add the hash of image
  fileName = fileName.concat(
    fileName.length > 0 ? '-' : '',
    splittedUrlName[splittedUrlName.length - 1]
  );

  return fileName;
}

function createCdnMarkdownNotice(name, CDN_PATH, relativesImagesNames) {
  return `# mailing – ${name}

## Chemin du CDN

${CDN_PATH}

## Liste des images à mettre sur le CDN :

${relativesImagesNames
  .map((img) => `- [${img}](${CDN_PATH}/${img})`)
  .join('\n')}

## Aperçu des images présentes sur le CDN

${relativesImagesNames
  .map((img) => `![${img}](${CDN_PATH}/${img})`)
  .join('\n\n')}

`;
}
function createHtmlNotice(name, CDN_PATH, relativesImagesNames) {
  return `<!DOCTYPE html>
<style>
  html {
    font-family:  -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
  }
</style>
<h1>mailing – ${name}</h1>

<h2>Chemin du CDN</h2>

${CDN_PATH}

<h2>Liste des images à mettre sur le CDN</h2>

<ol>
${relativesImagesNames
  .map((img) => `<li><a href="${CDN_PATH}/${img}">${img}</a></li>`)
  .join('\n')}
</ol>

<h2>Aperçu des images présentes sur le CDN</h2>

<ol>
${relativesImagesNames
  .map((img) => `<li><img src="${CDN_PATH}/${img}" /></li>`)
  .join('\n')}
</ol>
`;
}

module.exports = {
  getName,
  getImageName,
  createCdnMarkdownNotice,
  createHtmlNotice,
};
