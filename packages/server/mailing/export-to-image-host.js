'use strict';

// The export to an image host (ADR 0028): the email's images are put on the
// host, in a folder of the email's own, and the HTML is rewritten from the
// URLs the host returns (export-hosted-image-urls.js).

const net = require('net');
const http = require('http');
const https = require('https');
const fetch = require('node-fetch');
const { BadGateway, Forbidden } = require('http-errors');
const { Integrations } = require('../common/models.common.js');
const ProviderFactory = require('../integration-providers/provider-factory.js');
const {
  ProviderError,
  PROVIDER_ERROR_CODES,
} = require('../integration-providers/provider-error.js');
const IntegrationTypes = require('../constant/integration-type.js');
const ERROR_CODES = require('../constant/error-codes.js');
const {
  guardedLookup,
  isBlockedAddress,
} = require('../utils/outbound-host.js');
const { getName } = require('../utils/download-zip-markdown.js');
const { relativeImagePath } = require('./export-hosted-image-urls.js');
const config = require('../node.config.js');
const logger = require('../utils/logger.js');

const SOURCE_TIMEOUT_MS = 30000;
// One byte over the Emarsys limit is enough to know an image is too large.
const SOURCE_MAX_BYTES = 16 * 1024 * 1024 + 1;
// Images put on the host at the same time.
const CONCURRENCY = 4;
const MAX_REDIRECTS = 3;

// The sources of the images are URLs of the email's HTML, which its authors
// write: anything but our own images must be a public address. The agents
// check the addresses a name resolves to, at connection time; a literal IP
// never reaches them, so it is checked before (assertPublicLiteral).
const httpAgent = new http.Agent({ lookup: guardedLookup });
const httpsAgent = new https.Agent({ lookup: guardedLookup });

/**
 * The image host an export goes to: one of the email's company, an image
 * host, switched on, and validated when last tested.
 * @throws {Forbidden} IMAGE_HOST_NOT_AVAILABLE otherwise
 */
async function findImageHost({ integrationId, companyId }) {
  const integration = /^[0-9a-f]{24}$/i.test(String(integrationId))
    ? await Integrations.findById(String(integrationId))
    : null;
  const available =
    integration &&
    String(integration._company) === String(companyId) &&
    integration.type === IntegrationTypes.ASSET_HOSTING &&
    integration.isActive === true &&
    integration.validationStatus === 'valid';
  if (!available) throw new Forbidden(ERROR_CODES.IMAGE_HOST_NOT_AVAILABLE);
  return integration;
}

/**
 * The email's folder on the host: its name, and a short identifier so that
 * two emails of the same name never mix their images.
 */
function emailFolderName(mailing) {
  const shortId = String(mailing._id).slice(-6).toLowerCase();
  return `${getName(mailing.name)}-${shortId}`;
}

function isOwnImage(imageUrl) {
  try {
    return new URL(imageUrl).host === config.host;
  } catch (error) {
    return false;
  }
}

function assertPublicLiteral(url) {
  const { protocol, hostname } = new URL(url);
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new Error(`source protocol refused: ${protocol}`);
  }
  const address = hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(address) && isBlockedAddress(address)) {
    throw new Error('source address refused');
  }
}

/**
 * The bytes of an image. Redirects are followed by hand, each hop checked as
 * the first one: node-fetch would follow one to a literal private IP.
 * @param {string} imageUrl
 * @returns {Promise<Buffer>}
 */
async function readSource(imageUrl) {
  let current = imageUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const own = isOwnImage(current);
    if (!own) assertPublicLiteral(current);
    const response = await fetch(current, {
      redirect: 'manual',
      timeout: SOURCE_TIMEOUT_MS,
      size: SOURCE_MAX_BYTES,
      agent: own
        ? undefined
        : (parsed) => (parsed.protocol === 'http:' ? httpAgent : httpsAgent),
    });
    const location =
      response.status >= 300 && response.status < 400
        ? response.headers.get('location')
        : null;
    if (location) {
      current = new URL(location, current).href;
      continue;
    }
    if (!response.ok) {
      throw new Error(`source answered ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }
  throw new Error('source redirects too many times');
}

/**
 * Puts the images on the host, a few at a time.
 * @param {Object} params
 * @param {Object} params.integration the image host
 * @param {string} params.folderName
 * @param {Array<{ url: string, name: string }>} params.images
 * @returns {Promise<Map<string, string>>} relative path → hosted URL
 * @throws {BadGateway} IMAGE_HOST_UPLOAD_FAILED, its `images` the source URLs
 *   that failed, when one image or more could not be put on the host
 */
async function putImagesOnHost({ integration, folderName, images }) {
  const host = ProviderFactory.createProvider(integration);
  // One upload per name: two URLs of the same name share one relative path.
  const byName = new Map();
  images.forEach((image) => {
    if (!byName.has(image.name)) byName.set(image.name, image);
  });
  const queue = [...byName.values()];
  const hostedUrls = new Map();
  const failed = [];
  let credentialsRefused = false;

  async function worker() {
    while (queue.length) {
      const image = queue.shift();
      try {
        const content = await readSource(image.url);
        const { url } = await host.putImage({
          folderName,
          filename: image.name,
          content,
        });
        hostedUrls.set(relativeImagePath(image.name), url);
      } catch (error) {
        if (
          error instanceof ProviderError &&
          error.code === PROVIDER_ERROR_CODES.INVALID_CREDENTIALS
        ) {
          // Every image would fail alike: stop here.
          credentialsRefused = true;
          queue.length = 0;
          return;
        }
        logger.error('[EXPORT] image not put on the image host', {
          image: image.url,
          error: error.message,
        });
        failed.push(image.url);
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker)
  );

  if (credentialsRefused) {
    // Until a tech admin tests it again, the export menu no longer offers it.
    await Integrations.updateOne(
      { _id: integration._id },
      { $set: { validationStatus: 'invalid' } }
    );
    throw new BadGateway(ERROR_CODES.IMAGE_HOST_CREDENTIALS_REFUSED);
  }
  if (failed.length) {
    const error = new BadGateway(ERROR_CODES.IMAGE_HOST_UPLOAD_FAILED);
    error.images = images
      .map((image) => image.url)
      .filter((url) => failed.includes(url));
    throw error;
  }
  return hostedUrls;
}

module.exports = {
  findImageHost,
  emailFolderName,
  putImagesOnHost,
  // exported for testing
  readSource,
};
