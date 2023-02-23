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

  splittedUrlName.splice(0, 2);

  const coverPart = splittedUrlName[0] || '';
  const hasCoverPart = coverPart.includes('cover');

  // Test if old file name contains a cover value
  if (hasCoverPart) {
    fileName = fileName.concat(coverPart);
    splittedUrlName.splice(0, 1);
  }

  const sizePart =
    (hasCoverPart ? splittedUrlName[1] : splittedUrlName[0]) || '';

  // Test if old file name contains a size value
  const isSizePart = sizePart.match(/\d{1,5}x/g);

  if (isSizePart && isSizePart[0] !== undefined) {
    fileName = fileName.concat('-', sizePart);
    splittedUrlName.splice(0, 1);
  }

  const templateHashPart =
    (coverPart && hasCoverPart ? splittedUrlName[2] : splittedUrlName[0]) || '';

  // Test if old file name contains the hash of template to remove
  const containsTemplateHash = templateHashPart && templateHashPart.length > 14;

  if (containsTemplateHash) {
    splittedUrlName.splice(coverPart && hasCoverPart ? 1 : 2, 1);
  }

  // Add the hash of image
  fileName = fileName.concat(
    fileName.length > 0 ? '-' : '',
    splittedUrlName.join('-')
  );

  return fileName;
}
const hasUrlAlreadyParams = (url) => {
  return url.includes('?');
};

const getUrlWithTrackingParams = (link, tracking) => {
  if (!tracking) {
    return link;
  }

  let paramsToAdd = hasUrlAlreadyParams(link) ? '&' : '?';

  if (tracking?.trackingUrls) {
    console.log(tracking.trackingUrls);
    for (const trackingUrl of tracking?.trackingUrls) {
      const { key, value } = trackingUrl;
      console.log({ trackingUrl });
      if (key?.length > 0 && value?.length > 0) {
        if (!link.includes(key) && key?.length > 0 && value?.length > 0) {
          paramsToAdd += `${key}=${value}&`;
        }
      }
    }
  }

  if (tracking.hasGoogleAnalyticsUtm) {
    if (
      !link.includes(tracking.utmSourceKey) &&
      tracking?.utmSourceKey?.length > 0 &&
      tracking?.utmSourceValue?.length > 0
    ) {
      paramsToAdd += `${tracking.utmSourceKey}=${tracking.utmSourceValue}&`;
    }

    if (
      !link.includes(tracking.utmMediumKey) &&
      tracking?.utmMediumKey?.length > 0 &&
      tracking?.utmMediumValue?.length > 0
    ) {
      paramsToAdd += `${tracking.utmMediumKey}=${tracking.utmMediumValue}&`;
    }

    if (
      !link.includes(tracking.utmCampaignKey) &&
      tracking?.utmCampaignKey?.length > 0 &&
      tracking?.utmCampaignValue?.length > 0
    ) {
      paramsToAdd += `${tracking.utmCampaignKey}=${tracking.utmCampaignValue}&`;
    }
  }

  return encodeURI(`${link}${paramsToAdd.slice(0, -1)}`);
};

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
  getUrlWithTrackingParams,
  createCdnMarkdownNotice,
  createHtmlNotice,
};
