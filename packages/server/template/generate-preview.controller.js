'use strict';

const fs = require('fs-extra');
const crypto = require('crypto');
const path = require('path');
const sharp = require('sharp');
const puppeteer = require('puppeteer');
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');

const { NotFound } = require('http-errors');

const ERROR_CODES = require('../constant/error-codes.js');

const config = require('../node.config.js');
const { Templates, Mailings } = require('../common/models.common.js');
const fileManager = require('../common/file-manage.service.js');
const sseHelpers = require('../helpers/server-sent-events.js');
const slugFilename = require('../helpers/slug-filename');
const badsenderEvents = require('../helpers/event-bus.js');
const eventsNames = require('../helpers/event-names.js');
const _getTemplateImagePrefix = require('../utils/get-template-image-prefix.js');
const _getMailImagePrefix = require('../utils/get-mail-image-prefix.js');

// on heroku this build pack is needed
// https://github.com/jontewks/puppeteer-heroku-buildpack
const PROTOCOL = `http${config.forcessl ? 's' : ''}://`;
const VERSION_PAGE = `${PROTOCOL}${config.host}/api/version`;
const BLOCK_SELECTOR = '[data-ko-container] [data-ko-block]';
const BLOCK_BODY_MAIL_SELECTOR = 'main-wysiwyg-area';
const BLOCK_BODY_MAIL_SELECTOR_WITH_SHARP = `#${BLOCK_BODY_MAIL_SELECTOR}`;
module.exports = {
  previewMarkup: asyncHandler(previewMarkup),
  generatePreviews: asyncHandler(generatePreviews),
  previewMail: asyncHandler(previewMail),
  // asyncHandler for SSE routes is not needed
  previewEvents,
};

/**
 * @api {get} /templates/:templateId/preview template preview
 * @apiPermission admin
 * @apiName TemplatePreview
 * @apiDescription Show a template preview (used by preview generation)
 * @apiGroup Templates
 *
 * @apiParam {string} templateId
 *
 * @apiSuccess {String} body the template html
 */

// used by preview generation
async function previewMarkup(req, res) {
  const { templateId } = req.params;
  const template = await Templates.findById(templateId, { markup: 1 }).lean();
  if (!template) throw NotFound(ERROR_CODES.TEMPLATE_NOT_FOUND);
  if (!template.markup) throw NotFound(ERROR_CODES.TEMPLATE_NOT_FOUND);
  res.send(template.markup);
}

function getMarkupPreviewUrl(templateId) {
  return `${PROTOCOL}${config.host}/api/templates/${templateId}/preview`;
}

function getMailPreviewUrl(mailingId) {
  return `${PROTOCOL}${config.host}/editor/${mailingId}`;
}

function logDuration(message, start) {
  console.log(`${message} – ${(Date.now() - start) / 1000}s`);
}

/**
 * @api {post} /templates/:templateId/preview template miniatures generation
 * @apiPermission admin
 * @apiName CreateTemplatePreview
 * @apiDescription Launch a template images preview generation
 * @apiGroup Templates
 *
 * @apiParam {string} templateId
 *
 * @apiSuccess {String} id
 * @apiSuccess {String} status always `preview start`
 */

async function generatePreviews(req, res) {
  const { cookies } = req;
  const { templateId } = req.params;
  const template = await Templates.findById(templateId, { markup: 1 }).lean();
  if (!template) throw NotFound(ERROR_CODES.TEMPLATE_NOT_FOUND);
  if (!template.markup) throw NotFound(ERROR_CODES.TEMPLATE_NOT_FOUND);
  // don't wait for the full preview to be generated
  createPreviews({ templateId, cookies }).catch((error) => console.log(error));
  res.json({ id: templateId, status: 'preview start' });
}

const PREVIEW_EVENTS = [
  eventsNames.PREVIEW_START,
  eventsNames.PREVIEW_PROGRESS,
  eventsNames.PREVIEW_END,
  eventsNames.PREVIEW_ERROR,
];

function previewEvents(req, res) {
  const { templateId } = req.params;
  const isConnectionClosed = sseHelpers.createConnectionStatusPromise();

  res.writeHead(200, {
    Connection: 'keep-alive',
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
  });

  const sendTemplatePreviewEvent = sseHelpers.safeEventsHandler(
    async (data) => {
      if (data.payload.templateId !== templateId) return;
      await sseHelpers.writeResponse(res, data, isConnectionClosed);
    }
  );
  PREVIEW_EVENTS.forEach((eventName) =>
    badsenderEvents.on(eventName, sendTemplatePreviewEvent)
  );

  res.on('close', function cleanListeners() {
    isConnectionClosed.resolve();
    PREVIEW_EVENTS.forEach((eventName) =>
      badsenderEvents.off(eventName, sendTemplatePreviewEvent)
    );
    res.end();
  });
}

/**
 * @api {post} /templates/:templateId/events template events
 * @apiPermission admin
 * @apiName TemplateEvents
 * @apiDescription Events used when generating miniatures<br>
 *   this use Server Sent Events (SSE - see [MDN documentation](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events))
 * @apiGroup Templates
 *
 * @apiParam {string} templateId
 *
 * @apiSuccess {String} status one of `START` |  `UPDATE` |  `END` |  `ERROR`
 * @apiSuccess {String} originalEventName internal event name
 * @apiSuccess {Object} payload
 * @apiSuccess {String} payload.templateId
 * @apiSuccess {String} payload.message the server message
 * @apiSuccess {Object} [payload.error] the error object if `type === 'ERROR'`
 * @apiSuccess {Object} [payload.template] the template object if `type === 'END'`
 */

async function createPreviews({ templateId, cookies }) {
  const start = Date.now();
  let logMessage = 'starting generating previews';
  badsenderEvents.emit(eventsNames.PREVIEW_START, {
    type: eventsNames.EVENT_START,
    originalEventName: eventsNames.PREVIEW_START,
    payload: { templateId, message: logMessage },
  });

  // ----- RENDER THE MARKUP
  logMessage = '1/7 - get template markup';
  logDuration(`[PREVIEWS] ${logMessage}`, start);
  badsenderEvents.emit(eventsNames.PREVIEW_PROGRESS, {
    type: eventsNames.EVENT_UPDATE,
    originalEventName: eventsNames.PREVIEW_PROGRESS,
    payload: { templateId, message: logMessage },
  });

  const browser = await getHeadlessBrowser();
  // make a big try/catch to close browser on error
  try {
    const page = await browser.newPage();
    await page.goto(VERSION_PAGE);
    // copy cookies to keep authentication
    // • req.cookies are a big object
    // • puppeteer expect each cookie as an argument
    //   https://pptr.dev/#?product=Puppeteer&version=v1.11.0&show=api-pagesetcookiecookies
    const puppeteersCookies = Object.entries(cookies).map(([name, value]) => ({
      name,
      value,
    }));
    await page.setCookie(...puppeteersCookies);
    await page.goto(getMarkupPreviewUrl(templateId));

    // ----- RESIZE VIEWPORT (to have a fitted screenshot)
    logMessage = '2/7 - resize viewport';
    logDuration(`[PREVIEWS] ${logMessage}`, start);
    badsenderEvents.emit(eventsNames.PREVIEW_PROGRESS, {
      type: eventsNames.EVENT_UPDATE,
      originalEventName: eventsNames.PREVIEW_PROGRESS,
      payload: { templateId, message: logMessage },
    });

    const { width, height } = await page.evaluate(() => {
      // `preview` class is added to have more controls over previews
      // https://github.com/voidlabs/mosaico/issues/246#issuecomment-265979320
      document.body.classList.add('preview');
      return {
        width: Math.round(document.body.scrollWidth),
        height: Math.round(document.body.scrollHeight),
      };
    });
    await page.setViewport({
      width: Math.round(width),
      height: Math.round(height),
    });

    // ----- GATHER BLOCKS SIZES
    logMessage = '3/7 - prepare block screenshots';
    logDuration(`[PREVIEWS] ${logMessage}`, start);
    badsenderEvents.emit(eventsNames.PREVIEW_PROGRESS, {
      type: eventsNames.EVENT_UPDATE,
      originalEventName: eventsNames.PREVIEW_PROGRESS,
      payload: { templateId, message: logMessage },
    });

    const blocksInformations = await page.$$eval(BLOCK_SELECTOR, ($blocks) => {
      return $blocks.map(($block) => {
        // use dataset to preserve case
        const name = `${$block.dataset.koBlock}.png`;
        const { left, top, width, height } = $block.getBoundingClientRect();
        return {
          name,
          clip: {
            x: Math.round(left),
            y: Math.round(top),
            width: Math.round(width),
            height: Math.round(height),
          },
        };
      });
    });
    blocksInformations.push({
      name: '_full.png',
      clip: {
        x: 0,
        y: 0,
        width: Math.round(width),
        height: Math.round(height),
      },
    });

    // ----- TAKE SCREENSHOTS
    logMessage = '4/7 - take screenshots';
    logDuration(`[PREVIEWS] ${logMessage}`, start);
    badsenderEvents.emit(eventsNames.PREVIEW_PROGRESS, {
      type: eventsNames.EVENT_UPDATE,
      originalEventName: eventsNames.PREVIEW_PROGRESS,
      payload: { templateId, message: logMessage },
    });

    // this list will be used after to match an image buffer to a name
    const blocksName = blocksInformations.map(({ name }) => name);
    const imagesBuffer = await Promise.all(
      // calling puppeteer.screenshot without file path render a buffer
      blocksInformations.map(({ clip }) => page.screenshot({ clip }))
    );

    // ----- SAVE SCREENSHOTS TO TMP
    logMessage = '5/7 - save screenshots to temporary folder';
    logDuration(`[PREVIEWS] ${logMessage}`, start);
    badsenderEvents.emit(eventsNames.PREVIEW_PROGRESS, {
      type: eventsNames.EVENT_UPDATE,
      originalEventName: eventsNames.PREVIEW_PROGRESS,
      payload: { templateId, message: logMessage },
    });

    const templateAssetsField = {};
    const files = [];
    await Promise.all(
      imagesBuffer.map((imageBuffer, index) => {
        const imageLogName = `saving ${blocksName[index]}`;
        // Don't emit events for every images
        // badsenderEvents.emit(eventsNames.PREVIEW_PROGRESS, {
        //   type: eventsNames.EVENT_UPDATE,
        //   originalEventName: eventsNames.PREVIEW_PROGRESS,
        //   payload: { templateId, message: imageLogName },
        // })
        console.log(`[PREVIEWS] ${imageLogName}`);
        // slug to be coherent with upload
        const originalName = slugFilename(blocksName[index]);
        const hash = crypto.createHash('md5').update(imageBuffer).digest('hex');
        const name = `${_getTemplateImagePrefix(templateId)}-${hash}.png`;
        const filePath = path.join(config.images.tmpDir, `/${name}`);
        templateAssetsField[originalName] = name;
        files.push({
          path: filePath,
          name,
        });
        return fs.writeFile(filePath, imageBuffer);
      })
    );
    // ----- UPLOAD SCREENSHOTS
    logMessage = '6/7 - upload screenshots';
    logDuration(`[PREVIEWS] ${logMessage}`, start);
    badsenderEvents.emit(eventsNames.PREVIEW_PROGRESS, {
      type: eventsNames.EVENT_UPDATE,
      originalEventName: eventsNames.PREVIEW_PROGRESS,
      payload: { templateId, message: logMessage },
    });

    await Promise.all(
      files.map((file) => {
        const imageLogName = `upload ${file.name}`;
        badsenderEvents.emit(eventsNames.PREVIEW_PROGRESS, {
          type: eventsNames.EVENT_UPDATE,
          originalEventName: eventsNames.PREVIEW_PROGRESS,
          payload: { templateId, message: imageLogName },
        });
        console.log(`[PREVIEWS] ${imageLogName}`);
        // images are captured at 680 but displayed at half the size
        const pipeline = sharp().resize(340, null);
        fs.createReadStream(file.path).pipe(pipeline);
        return fileManager.writeStreamFromStream(pipeline, file.name);
      })
    );

    // ----- UPDATE WIREFRAME ASSETS
    logMessage = '7/7 - update template assets in database';
    logDuration(`[PREVIEWS] ${logMessage}`, start);
    badsenderEvents.emit(eventsNames.PREVIEW_PROGRESS, {
      type: eventsNames.EVENT_UPDATE,
      originalEventName: eventsNames.PREVIEW_PROGRESS,
      payload: { templateId, message: logMessage },
    });

    const template = await Templates.findById(templateId);
    template.assets = Object.assign(
      {},
      template.assets || {},
      templateAssetsField
    );
    template.markModified('assets');
    await template.save();

    // ----- THE END
    await Templates.findById(templateId).populate({
      path: '_company',
      select: 'id name',
    });
    badsenderEvents.emit(eventsNames.PREVIEW_END, {
      type: eventsNames.EVENT_END,
      originalEventName: eventsNames.PREVIEW_END,
      payload: { templateId, message: logMessage, template },
    });
    await browser.close();
  } catch (error) {
    badsenderEvents.emit(eventsNames.PREVIEW_ERROR, {
      type: eventsNames.EVENT_ERROR,
      originalEventName: eventsNames.PREVIEW_ERROR,
      payload: { templateId, error },
    });
    // close browser even if there is a problem
    await browser.close();
    throw error;
  }
}

async function storePreview(mailingId, preview) {
  const { previewFileUrl, _company } = await Mailings.findOne({
    _id: mongoose.Types.ObjectId(mailingId),
  });

  const file = {
    name: previewFileUrl,
    path: path.join(config.images.tmpDir, `/${previewFileUrl}`),
  };

  if (!previewFileUrl) {
    const hash = crypto.createHash('md5').update(preview).digest('hex');
    const name = `${mailingId}-${hash}.png`;
    const filePath = path.join(config.images.tmpDir, `/${name}`);

    file.name = name;
    file.path = filePath;
  }

  await fs.writeFile(file.path, preview);

  const stream = await fs.createReadStream(file.path);

  const prefix = `groups/${_company}/mailings/${mailingId}/preview`;
  await fileManager.writeStreamFromStreamWithPrefix(stream, file.name, prefix);

  await Mailings.updateOne(
    { _id: mongoose.Types.ObjectId(mailingId) },
    { previewFileUrl: file.name }
  );
}

async function previewMail({ mailingId, cookies }) {
  if (!(await Mailings.exists({ _id: mongoose.Types.ObjectId(mailingId) }))) {
    throw new NotFound(ERROR_CODES.MAILING_NOT_FOUND);
  }

  const browser = await getHeadlessBrowser();
  try {
    const page = await browser.newPage();
    const navigationPromise = page.waitForNavigation({
      waitUntil: 'domcontentloaded',
    });
    page.setDefaultNavigationTimeout(0);
    // copy cookies to keep authentication
    // • req.cookies are a big object
    // • puppeteer expect each cookie as an argument
    //   https://pptr.dev/#?product=Puppeteer&version=v1.11.0&show=api-pagesetcookiecookies
    const puppeteersCookies = Object.entries(cookies).map(([name, value]) => ({
      url: getMailPreviewUrl(mailingId),
      name,
      value,
    }));
    await page.setCookie(...puppeteersCookies);
    await page.goto(getMailPreviewUrl(mailingId), {
      waitUntil: 'networkidle2',
      timeout: 3000000,
    });
    await navigationPromise;
    await page.waitForSelector(BLOCK_BODY_MAIL_SELECTOR_WITH_SHARP); // wait for the selector to load
    const $element = await page.$(BLOCK_BODY_MAIL_SELECTOR_WITH_SHARP);
    const imagePreviewNameWithoutExtension = _getMailImagePrefix(mailingId);

    const {
      width,
      height,
      imagePreviewNameWithExtension,
    } = await page.evaluate(
      ({ BLOCK_BODY_MAIL_SELECTOR, imagePreviewNameWithoutExtension }) => {
        const $element = document.getElementById(BLOCK_BODY_MAIL_SELECTOR);
        return {
          fileName: `${imagePreviewNameWithoutExtension}.png`,
          width: Math.round($element.scrollWidth),
          height: Math.round($element.scrollHeight),
        };
      },
      {
        BLOCK_BODY_MAIL_SELECTOR,
        imagePreviewNameWithoutExtension,
      }
    );

    await page.setViewport({
      width: width,
      height: height,
    });

    const screenShot = await $element.screenshot({
      path: imagePreviewNameWithExtension,
    });

    await browser.close();

    await storePreview(mailingId, screenShot);

    return screenShot;
  } catch (error) {
    // close browser even if there is a problem
    await browser.close();
    throw error;
  }
}

async function getHeadlessBrowser() {
  return puppeteer.launch({
    args: [
      // https://peter.sh/experiments/chromium-command-line-switches/#hide-scrollbars
      '--hide-scrollbars',
      '--mute-audio',
      // https://github.com/jontewks/puppeteer-heroku-buildpack#puppeteer-heroku-buildpack
      '--no-sandbox',
    ],
  });
}
