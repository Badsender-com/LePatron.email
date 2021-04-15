'use strict';

const sharp = require('sharp');
const asyncHandler = require('express-async-handler');
const createError = require('http-errors');
const { inspect } = require('util');
const stream = require('stream');
const probe = require('probe-image-size');
const GifSicle = require('gifsicle-stream');
const mime = require('mime-types');
const { duration } = require('moment');
const { green, red } = require('chalk');

const config = require('../node.config.js');
const fileManager = require('../common/file-manage.service.js');
const { CacheImages, Galleries } = require('../common/models.common.js');
const imageService = require('./image.service');

console.log('[IMAGES] config.images.cache', config.images.cache);

module.exports = {
  cover,
  resize,
  placeholder,
  checkImageCache,
  checkSizes,
  list: asyncHandler(list),
  create: asyncHandler(create),
  read,
  readFromPreviews,
  destroy,
};

/// ///
// IMAGE UTILS
/// ///

let cacheControl = config.isDev
  ? duration(30, 'minutes')
  : duration(1, 'years');
cacheControl = cacheControl.asSeconds();

function addCacheControl(res) {
  if (!config.images.cache) return;
  res.set('Cache-Control', `public, max-age=${cacheControl}`);
}

function getTargetDimensions(sizes) {
  sizes = sizes.split('x');
  sizes = sizes.map((s) => (s === 'null' ? null : ~~s));
  return sizes;
}

function needResize(value, width, height) {
  if (!value) return true;
  const sameWidth = value.width === width;
  const sameHeight = value.height === height;
  if (sameWidth && sameHeight) return false;
  if (!width && sameHeight) return false;
  if (!height && sameWidth) return false;
  return true;
}

const handleFileStreamError = (next) => (err) => {
  console.log(red('read stream error'));
  // Local => ENOENT || S3 => NoSuchKey
  const isNotFound = err.code === 'ENOENT' || err.code === 'NoSuchKey';
  if (isNotFound) return next(new createError.NotFound());
  next(err);
};

const onWriteResizeEnd = (datas) => () => {
  const { path, name, imageName } = datas;

  // save in DB for cataloging
  new CacheImages({
    path,
    name,
    imageName,
  })
    .save()
    .then(() => console.log(green('cache image infos saved in DB', path)))
    .catch((e) => {
      console.log(red('[IMAGE] can\'t save cache image infos in DB'), path);
      console.log(inspect(e));
    });
};

// transform /cover/100x100/filename.jpg => cover_100x100_filename.jpg
const getResizedImageName = (path) => {
  return path.replace(/^\//, '').replace(/\//g, '_');
};

const onWriteResizeError = (path) => (e) => {
  console.log('[IMAGE] can\'t upload resize/placeholder result', path);
  console.log(inspect(e));
};

// sharp's pipeline are different from usual streams
function handleSharpStream(req, res, next, pipeline) {
  const { path } = req;
  const { imageName } = req.params;

  // prepare sending to response
  pipeline.clone().pipe(res);

  // prepare sending to cache
  if (config.images.cache) {
    const name = getResizedImageName(req.path);

    fileManager
      .writeStreamFromStream(pipeline.clone(), name)
      .then(onWriteResizeEnd({ path, name, imageName }))
      .catch(onWriteResizeError(path));
  }
  // flow readStream into the pipeline!
  // this has to be done after of course :D
  fileManager.streamImage(imageName).pipe(pipeline);
}

// unlike sharp, no .clone() method
// do it in a “standard” way
const handleGifStream = (req, res, next, gifProcessor) => {
  const { path } = req;
  const { imageName } = req.params;

  const resizedStream = fileManager.streamImage(imageName).pipe(gifProcessor);
  const streamForResponse = resizedStream.pipe(new stream.PassThrough());

  streamForResponse.pipe(res);

  if (!config.images.cache) return;

  const streamForSave = resizedStream.pipe(new stream.PassThrough());
  const name = getResizedImageName(path);

  fileManager
    .writeStreamFromStream(streamForSave, name)
    .then(onWriteResizeEnd({ path, name, imageName }))
    .catch(onWriteResizeError(path));
};

const streamImageToResponse = (req, res, next, imageName) => {
  const imageStream = fileManager.streamImage(imageName);
  const contentType = mime.lookup(imageName);
  imageStream.on('error', handleFileStreamError(next));
  // We have to end stream manually on res stream error (can happen if user close connection before end)
  // If not done, we will have a memory leaks
  // https://groups.google.com/d/msg/nodejs/wtmIzV0lh8o/cz3wqBtDc-MJ
  // https://groups.google.com/forum/#!topic/nodejs/A8wbaaPmmBQ
  imageStream.once('readable', () => {
    addCacheControl(res);
    // try to guess content-type from filename
    // we should do a better thing like a fs-stat
    // http://stackoverflow.com/questions/13485933/createreadstream-send-file-http#answer-13486341
    // but we want the response to be as quick as possible
    if (contentType) res.set('Content-Type', contentType);

    imageStream
      .pipe(res)
      // response doesn't have a 'close' event but a finish one
      // this shouldn't be useful because at this point stream would be entirely consumed and released
      .on('finish', imageStream.destroy.bind(imageStream))
      // this is mandatory
      .on('error', imageStream.destroy.bind(imageStream));
  });
};

const streamImageToResponseForPreviews = (req, res, next, imageName, prefix) => {
  const imageStream = fileManager.streamImageFromPreviews(imageName, prefix);

  const contentType = mime.lookup(imageName);
  imageStream.on('error', handleFileStreamError(next));
  // We have to end stream manually on res stream error (can happen if user close connection before end)
  // If not done, we will have a memory leaks
  // https://groups.google.com/d/msg/nodejs/wtmIzV0lh8o/cz3wqBtDc-MJ
  // https://groups.google.com/forum/#!topic/nodejs/A8wbaaPmmBQ
  imageStream.once('readable', () => {
    addCacheControl(res);
    // try to guess content-type from filename
    // we should do a better thing like a fs-stat
    // http://stackoverflow.com/questions/13485933/createreadstream-send-file-http#answer-13486341
    // but we want the response to be as quick as possible
    if (contentType) res.set('Content-Type', contentType);

    imageStream
      .pipe(res)
      // response doesn't have a 'close' event but a finish one
      // this shouldn't be useful because at this point stream would be entirely consumed and released
      .on('finish', imageStream.destroy.bind(imageStream))
      // this is mandatory
      .on('error', imageStream.destroy.bind(imageStream));
  });
};

/// ///
// IMAGE CHECKS
/// ///

// TODO gif can be optimized by using image-min
// https://www.npmjs.com/package/image-min

// Sharp can print harmless warn messages:
// =>   vips warning: VipsJpeg: error reading resolution
// https://github.com/lovell/sharp/issues/657

function checkImageCache(req, res, next) {
  if (!config.images.cache) return next();

  const { path } = req;
  CacheImages.findOne({ path })
    .lean()
    .then(onCacheImage)
    .catch((e) => {
      console.log('[CHECK SIZES] error in image cache check');
      console.log(inspect(e));
      next();
    });

  function onCacheImage(cacheInformations) {
    if (cacheInformations === null) return next();
    // console.log( bgGreen.black(path), 'already in cache' )
    streamImageToResponse(req, res, next, cacheInformations.name);
  }
}

function checkSizes(req, res, next) {
  const [width, height] = getTargetDimensions(req.params.sizes);
  const { imageName } = req.params;
  // console.log('[CHECK SIZES]', imageName, { width, height } )
  const imgStream = fileManager.streamImage(imageName);

  probe(imgStream)
    .then((imageDatas) => {
      // abort connection;
      // https://github.com/nodeca/probe-image-size/blob/master/README.md#example
      imgStream.destroy();
      if (!needResize(imageDatas, width, height)) {
        return streamImageToResponse(req, res, next, imageName);
      }

      req.imageDatas = imageDatas;
      res.set('Content-Type', imageDatas.mime);

      next();
    })
    .catch(handleFileStreamError(next));
}

/// ///
// IMAGE GENERATION
/// ///

/**
 * @api {get} /images/resize/:sizes/:imageName image crop
 * @apiPermission public
 * @apiName ImageResize
 * @apiGroup Images
 *
 * @apiParam {string} sizes size format is width`x`height (ex: `100x100`)<br>`null` can  be passed as a size
 * @apiParam {string} imageName
 *
 */

function resize(req, res, next) {
  const { imageDatas } = req;
  const [width, height] = getTargetDimensions(req.params.sizes);

  addCacheControl(res);

  // Sharp can't handle animated gif
  if (imageDatas.type !== 'gif') {
    const pipeline = sharp().resize(width, height);
    return handleSharpStream(req, res, next, pipeline);
  }

  const resize = ['--resize'];
  resize.push(`${width || '_'}x${height || '_'}`);
  const gifProcessor = new GifSicle([...resize, '--resize-colors', '64']);

  return handleGifStream(req, res, next, gifProcessor);
}

/**
 * @api {get} /images/cover/:sizes/:imageName image cover
 * @apiDescription see [CSS object-fit](https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit) description to see how _cover_ is handled
 * @apiPermission public
 * @apiName ImageCover
 * @apiGroup Images
 *
 * @apiParam {string} sizes size format is width`x`height (ex: `100x100`)<br>`null` can  be passed as a size
 * @apiParam {string} imageName
 *
 */

function cover(req, res, next) {
  const { imageDatas } = req;
  const [width, height] = getTargetDimensions(req.params.sizes);

  addCacheControl(res);

  // Sharp can't handle animated gif
  if (imageDatas.type !== 'gif') {
    const pipeline = sharp().resize(width, height);
    return handleSharpStream(req, res, next, pipeline);
  }

  // there is no build-in cover method with gifsicle
  // http://www.lcdf.org/gifsicle/man.html
  const originalWidth = imageDatas.width;
  const originalHeight = imageDatas.height;
  const targetWidthRatio = width ? originalWidth / width : width;
  const targetHeightRatio = height ? originalHeight / height : height;
  const widthRatio = targetWidthRatio || targetHeightRatio || 1;
  const heightRatio = targetHeightRatio || targetWidthRatio || 1;
  let newWidth = originalWidth;
  let newHeight = originalHeight;
  const crop = ['--crop'];

  // Trim the image to have the same ratio as the target
  // This operation is done before everything else by gifsicle
  if (widthRatio < heightRatio) {
    newHeight = (originalHeight / heightRatio) * widthRatio;
    newHeight = Math.round(newHeight);
    // diff is for centering the crop
    const diff = Math.round((originalHeight - newHeight) / 2);
    crop.push(`0,${diff}+0x${diff * -1}`);
  } else {
    newWidth = (originalWidth / widthRatio) * heightRatio;
    newWidth = Math.round(newWidth);
    const diff = Math.round((originalWidth - newWidth) / 2);
    crop.push(`${diff},0+${diff * -1}x0`);
  }

  // Scale to the same size as the target
  const scale = ['--scale', `${height / newHeight}`];

  // Resize to be sure that the sizes are equals
  // as we have done some rounding before, there may be some slightly differences in sizes
  // --resize will no preserve aspect-ratio…
  // …but it should be unnoticeable as we are mostly speaking of 1 or 2 pixels
  const resize = ['--resize', `${width}x${height}`, '--resize-colors', '64'];

  const gifProcessor = new GifSicle([...crop, ...scale, ...resize]);

  return handleGifStream(req, res, next, gifProcessor);
}

const stripeSize = 55;
const lightStripe = '#808080';
const darkStripe = '#707070';
const textColor = '#B0B0B0';
function generatePlaceholderSVG(width, height) {
  // centering text in SVG
  // http://stackoverflow.com/questions/5546346/how-to-place-and-center-text-in-an-svg-rectangle#answer-31522006
  return `<svg width="${width}" height="${height}">
    <defs>
    <pattern id="pattern" width="${stripeSize}" height="1" patternUnits="userSpaceOnUse" patternTransform="rotate(-45 0 0)">
      <line stroke="${lightStripe}" stroke-width="${stripeSize}px" y2="10"/>
    </pattern>
  </defs>
  <rect x="0" y="0" width="${width}" height="${height}" fill="${darkStripe}" />
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#pattern)" />
  <text x="50%" y="50%" alignment-baseline="middle" text-anchor="middle" fill="${textColor}" font-family="Verdana" font-size="20">
    ${width} x ${height}
  </text>
</svg>`;
}

/**
 * @api {get} /images/placeholder/:placeholderSize placeholder
 * @apiPermission public
 * @apiName GetPlaceholder
 * @apiGroup Images
 *
 * @apiParam {string} placeholderSize size format is width`x`height (ex: `100x100`)
 *
 */

function placeholder(req, res) {
  const { path } = req;
  const { placeholderSize } = req.params;
  const sizes = /(\d+)x(\d+)\.png/.exec(placeholderSize);
  const width = ~~sizes[1];
  const height = ~~sizes[2];
  const svgBuffer = Buffer.from(generatePlaceholderSVG(width, height));
  const pipeline = sharp(svgBuffer).png();

  addCacheControl(res);
  res.set('Content-Type', 'image/png');

  // don't use handleSharpStream()
  // we don't read a file but feed a buffer
  // prepare sending to response
  pipeline.clone().pipe(res);

  // prepare sending to cache
  if (!config.images.cache) return;
  const name = getResizedImageName(req.path);

  fileManager
    .writeStreamFromStream(pipeline.clone(), name)
    .then(onWriteResizeEnd({ path, name, imageName: placeholderSize }))
    .catch(onWriteResizeError(path));
}

/// ///
// OTHER THINGS
/// ///

/**
 * @api {get} /images/:imageName image display
 * @apiPermission public
 * @apiName GetImage
 * @apiGroup Images
 *
 * @apiParam {string} imageName
 *
 */

function read(req, res, next) {
  const { imageName } = req.params;
  streamImageToResponse(req, res, next, imageName);
}

function readFromPreviews(req, res, next) {
  const { imageName, groupId, mailingId } = req.params;
  const prefix = `/groups/${groupId}/mailings/${mailingId}/preview`;

  streamImageToResponseForPreviews(req, res, next, imageName, prefix)
}

/// ///
// EDITOR SPECIFIC
/// ///

function createGallery(mongoId) {
  // create the gallery in DB
  return fileManager.list(mongoId).then((files) => {
    return new Galleries({
      creationOrWireframeId: mongoId,
      files,
    }).save();
  });
}

/**
 * @api {get} /images/gallery/:mailingOrTemplateId gallery images list
 * @apiPermission public
 * @apiName GetGalleryImages
 * @apiGroup Images
 *
 * @apiParam {string} mailingOrTemplateId
 *
 * @apiUse galleryImages
 *
 */

// Those functions are accessible only from the editor
// wireframes assets (preview & template fixed assets)…
// …are handled separately in wireframes.js#update
async function list(req, res) {
  const { mongoId } = req.params;

  const gallery = await Galleries.findOne(
    {
      creationOrWireframeId: mongoId,
    },
    'files'
  );

  const responseGallery = gallery || (await createGallery(mongoId));
  res.json(responseGallery);
}

/**
 * @api {post} /images/gallery/:mailingOrTemplateId gallery images upload
 * @apiPermission public
 * @apiName PostGalleryImages
 * @apiGroup Images
 *
 * @apiParam {string} mailingOrTemplateId
 *
 * @apiUse galleryImages
 *
 */

// upload & update gallery
async function create(req, res) {
  const { mongoId } = req.params;
  const multipartOptions = {
    prefix: mongoId,
    formatter: 'editor',
  };
  const [uploads, gallery] = await Promise.all([
    fileManager.parseMultipart(req, multipartOptions),
    Galleries.findOne({ creationOrWireframeId: mongoId }),
  ]);

  // gallery could not be created at this point
  // without opening galleries panel in the editor no automatic DB gallery creation :(
  const safeGallery = gallery || (await createGallery(mongoId));
  const galleryImages = safeGallery.files.map((file) => ({ ...file }));
  const galleryImagesName = galleryImages.map((file) => file.name);

  uploads.files.forEach((upload) => {
    const imageName = upload.name;
    const hasAlreadyCurrentFile = galleryImagesName.includes(imageName);
    if (hasAlreadyCurrentFile) return;
    galleryImages.push(upload);
  });
  safeGallery.files = galleryImages;

  safeGallery.markModified('files');
  await safeGallery.save();

  // send only the new uploads
  // front-application will iterate over them to update the gallery previews
  res.json(uploads);
}

// destroy an image is not a real deletion…
// …because those images can be still used inside creations:
//  - cache can be inactive
//  - if active: we are not sure that cropped images are cached
//  - even though every cropped images are cached
//    an image can be used at it's original size (no cropped image cache)
// so:
//  - we just flag this image in the gallery table as not visible
function destroy(req, res, next) {
  if (!req.xhr) return next(new createError.NotImplemented());
  const { imageName } = req.params;
  let mongoId = /^([a-f\d]{24})-/.exec(imageName);
  if (!mongoId) return next(new createError.UnprocessableEntity());
  mongoId = mongoId[1];

  imageService
    .destroy(mongoId, imageName)
    .then((gallery) => {
      res.send({ files: gallery.files });
    })
    .catch(next);
}
