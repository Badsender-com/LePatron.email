'use strict';

const _ = require('lodash');
const url = require('url');
const getSlug = require('speakingurl');
// const cheerio = require('cheerio')
const archiver = require('archiver');
const request = require('request');
const createError = require('http-errors');
const asyncHandler = require('express-async-handler');

const createPromise = require('../helpers/create-promise.js');
const { Mailings, Groups } = require('../common/models.common.js');
const modelsUtils = require('../utils/model.js');
const processMosaicoHtmlRender = require('../utils/process-mosaico-html-render.js');
const Ftp = require('./ftp-client.service.js');

module.exports = asyncHandler(downloadZip);

// eslint-disable-next-line no-unused-vars
function isHttpUrl(uri) {
  return /^http/.test(uri);
}

const IMAGES_FOLDER = 'images';

/**
 * @api {post} /mailings/:mailingId/mosaico/download-zip mailing download
 * @apiPermission user
 * @apiName DownloadMailing
 * @apiDescription Zip format options are configured in the group
 * @apiGroup Mailings
 *
 * @apiParam {string} mailingId
 *
 * @apiParam (Body) {String} html the HTML output get in mosaico by `viewModel.exportHTML()`
 * @apiParam (Body) {Boolean} downLoadForCdn wether or not images should point to a CDN<br> Depends on group configuration
 *
 */

// for doc see:
// https://github.com/archiverjs/node-archiver/blob/master/examples/express.js
// we need to keep the `next` callback to handle zip events
async function downloadZip(req, res, next) {
  const { user, body } = req;
  const { mailingId } = req.params;
  const query = modelsUtils.addGroupFilter(user, { _id: mailingId });
  // mailing can come without group if created by the admin
  // • in order to retrieve the group, look at the wireframe
  const mailing = await Mailings.findOne(query)
    .select({ _wireframe: 1, name: 1 })
    .populate('_wireframe');
  if (!mailing) throw new createError.NotFound();
  // TODO: add back group check
  // if (!isFromCompany(user, mailing._company)) throw new createError.Unauthorized()

  // group is needed to check zip format & DL configuration
  const group = await Groups.findById(mailing._wireframe._company).lean();
  const {
    downloadMailingWithoutEnclosingFolder,
    downloadMailingWithCdnImages,
    cdnProtocol,
    cdnEndPoint,
    downloadMailingWithFtpImages,
    ftpProtocol,
    ftpHost,
    ftpUsername,
    ftpPassword,
    ftpPort,
    ftpEndPoint,
    ftpEndPointProtocol,
    ftpPathOnServer,
  } = group;

  const archive = archiver('zip');
  const name = getName(mailing.name);
  // prefix is `zip-stream` file prefix => our enclosing folder ^_^
  // !WARNING default mac unzip will always put it in an folder if more than 1 file
  // => test with The Unarchiver
  const prefix = downloadMailingWithoutEnclosingFolder ? '' : `${name}/`;
  let { html, ...downloadOptions } = body;
  // Because this is cans come as a real from submit
  // downLoadForCdn & downLoadForFtp might come as a string
  downloadOptions.downLoadForCdn =
    downloadOptions.downLoadForCdn === 'true' ||
    downloadOptions.downLoadForCdn === true;

  downloadOptions.downLoadForFtp =
    downloadOptions.downLoadForFtp === 'true' ||
    downloadOptions.downLoadForFtp === true;

  // const $ = cheerio.load(html)

  console.log('download zip', name);

  // ----- IMAGES

  // keep a track of every images for latter download
  // be careful to avoid data uri
  // relatives path are not handled:
  //  - the mailing should work also by email test
  //  - SO no need to handle them
  // const $images = $(`img`)
  // const imgUrls = _.uniq(
  //   $images
  //     .map((i, el) => $(el).attr(`src`))
  //     .get()
  //     .filter(isHttpUrl),
  // )
  // const $background = $(`[background]`)
  // const bgUrls = _.uniq(
  //   $background
  //     .map((i, el) => $(el).attr(`background`))
  //     .get()
  //     .filter(isHttpUrl),
  // )
  // const $style = $(`[style]`)
  // const styleUrls = []
  // $style
  //   .filter((i, el) => /url\(/.test($(el).attr(`style`)))
  //   .each((i, el) => {
  //     const urlReg = /url\('?([^)']*)/
  //     const style = $(el).attr(`style`)
  //     const result = urlReg.exec(style)
  //     if (
  //       result &&
  //       result[1] &&
  //       isHttpUrl(result[1]) &&
  //       !styleUrls.includes(result[1])
  //     ) {
  //       styleUrls.push(result[1])
  //     }
  //   })

  const remainingUrlsRegex = /https?:\S+\.(jpg|jpeg|png|gif){1}/g;
  const allImages = html.match(remainingUrlsRegex) || [];

  // const allImages = _.uniq([...imgUrls, ...bgUrls, ...styleUrls])
  // console.log(remainingUrls, allImages)

  // keep a dictionary of all downloaded images
  // • this will help us for CDN images
  const relativesImagesNames = [];
  // change path to match downloaded images
  // Don't use Cheerio because:
  // • when exporting it's messing with ESP tags
  // • Cheerio won't handle IE comments
  allImages.forEach((imgUrl) => {
    const escImgUrl = _.escapeRegExp(imgUrl);
    const imageName = getImageName(imgUrl);
    const relativeUrl = `${IMAGES_FOLDER}/${imageName}`;
    relativesImagesNames.push(imageName);
    console.log(imgUrl, relativeUrl);
    const search = new RegExp(escImgUrl, 'g');
    html = html.replace(search, relativeUrl);
  });

  archive.on('error', next);

  // on stream closed we can end the request
  archive.on('end', () => {
    console.log(`Archive wrote ${archive.pointer()} bytes`);
    res.end();
  });

  // set the archive name
  res.attachment(`${name}.zip`);

  // this is the streaming magic
  archive.pipe(res);

  const cdnDownload =
    downloadMailingWithCdnImages && downloadOptions.downLoadForCdn;
  const ftpDownload =
    downloadMailingWithFtpImages && downloadOptions.downLoadForFtp;
  const regularDownload = !cdnDownload && !ftpDownload;

  // Pipe all images BUT don't add errored images
  if (cdnDownload || regularDownload) {
    const imagesRequest = allImages.map((imageUrl) => {
      const imageName = getImageName(imageUrl);
      const defer = createPromise();
      const imgRequest = request(imageUrl);

      imgRequest.on('response', (response) => {
        // only happen images with a code of 200
        if (response.statusCode === 200) {
          archive.append(imgRequest, {
            prefix: `${prefix}${IMAGES_FOLDER}/`,
            name: imageName,
          });
        }
        defer.resolve();
      });
      imgRequest.on('error', (imgError) => {
        console.log('[ZIP] error during downloading', imageUrl);
        console.log(imgError);
        // still resolve, just don't add this errored image to the archive
        defer.resolve();
      });

      return defer;
    });

    await Promise.all(imagesRequest);
  } else {
    const ftpClient = new Ftp(
      ftpHost,
      ftpPort,
      ftpUsername,
      ftpPassword,
      ftpProtocol
    );
    const folderPath =
      ftpPathOnServer +
      (ftpPathOnServer.substr(ftpPathOnServer.length - 1) === '/' ? '' : '/') +
      `${name}/`;

    ftpClient.upload(allImages, folderPath);
  }

  // ----- HTML

  // Add html with relatives url
  const processedHtml = processMosaicoHtmlRender(html);

  if (regularDownload) {
    archive.append(processedHtml, {
      prefix,
      name: `${name}.html`,
    });
  } else {
    // archive
    const endpointBase = cdnDownload
      ? `${cdnProtocol}${cdnEndPoint}`
      : `${ftpEndPointProtocol}${ftpEndPoint}`;
    const endpointPath = `${endpointBase}${
      endpointBase.substr(endpointBase.length - 1) === '/' ? '' : '/'
    }${name}`;
    let html = processedHtml;

    relativesImagesNames.forEach((imageName) => {
      const imgRegex = new RegExp(`${IMAGES_FOLDER}/${imageName}`, 'g');
      html = html.replace(imgRegex, `${endpointPath}/${imageName}`);
    });
    archive.append(html, {
      prefix,
      name: `${name}.html`,
    });

    if (cdnDownload) {
      // notice
      const CDN_MD_NOTICE = createCdnMarkdownNotice(
        name,
        endpointPath,
        relativesImagesNames
      );
      archive.append(CDN_MD_NOTICE, {
        prefix,
        name: 'notice.md',
      });
      const CDN_HTML_NOTICE = createHtmlNotice(
        name,
        endpointPath,
        relativesImagesNames
      );
      archive.append(CDN_HTML_NOTICE, {
        prefix,
        name: 'notice.html',
      });
    }
  }

  archive.finalize();
}

function getName(name) {
  name = name || 'email';
  return getSlug(name.replace(/\.[0-9a-z]+$/, ''));
}

function getImageName(imageUrl) {
  // eslint-disable-next-line node/no-deprecated-api
  return url
    .parse(imageUrl)
    .pathname.replace(/\//g, ' ')
    .trim()
    .replace(/\s/g, '-');
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
