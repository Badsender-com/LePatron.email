'use strict';

// The export to an image host (ADR 0028): the email's images are put on the
// host, in a folder of the email's own, and the HTML is rewritten from the
// URLs the host returns (export-hosted-image-urls.js).

const crypto = require('crypto');
const net = require('net');
const http = require('http');
const https = require('https');
const fetch = require('node-fetch');
const { BadGateway, Forbidden } = require('http-errors');
const { Integrations, HostedImages } = require('../common/models.common.js');
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
  // A name made of characters the slug drops still gets a readable folder.
  return `${getName(mailing.name) || 'email'}-${shortId}`;
}

// Our own gallery's images only: the rest of our host gets no exemption.
function isOwnImage(imageUrl) {
  try {
    const { host, pathname } = new URL(imageUrl);
    return host === config.host && pathname.startsWith('/api/images/');
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
 * the first one: node-fetch would follow one to a literal private IP. One
 * deadline for the whole chain, not one per hop.
 * @param {string} imageUrl
 * @returns {Promise<Buffer>}
 */
async function readSource(imageUrl) {
  const deadline = Date.now() + SOURCE_TIMEOUT_MS;
  let current = imageUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const own = isOwnImage(current);
    if (!own) assertPublicLiteral(current);
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('source timed out');
    const response = await fetch(current, {
      redirect: 'manual',
      timeout: remaining,
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
      // Read off, so that the socket is freed for the next hop.
      if (response.body && typeof response.body.resume === 'function') {
        response.body.resume();
      }
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
 * @param {*} params.mailingId the email, whose hosted images are reused
 * @param {string} params.folderName
 * @param {Array<{ url: string, name: string }>} params.images
 * @returns {Promise<Map<string, string>>} relative path → hosted URL
 * @throws {BadGateway} IMAGE_HOST_UPLOAD_FAILED, its `images` the source URLs
 *   that failed, when one image or more could not be put on the host
 */
async function putImagesOnHost({ integration, mailingId, folderName, images }) {
  const host = ProviderFactory.createProvider(integration);
  // One upload per name: two URLs of the same name share one relative path.
  const byName = new Map();
  images.forEach((image) => {
    if (!byName.has(image.name)) byName.set(image.name, image);
  });
  const queue = [...byName.values()];

  // The email's folder first, once: a root folder deleted in Emarsys, or a
  // host that is down, is no image's fault.
  let folderId;
  try {
    folderId = await host.emailFolderId(folderName);
  } catch (error) {
    if (hostFailureOf(error) === 'credentials') {
      return refuseCredentials(integration);
    }
    logger.error('[EXPORT] image host folder unavailable', {
      folderName,
      error: error.message,
    });
    throw new BadGateway(ERROR_CODES.IMAGE_HOST_FOLDER_UNAVAILABLE);
  }

  const hostedUrls = new Map();
  // By content: two names of the same bytes are put once, even at the same
  // time, and share one hosted image.
  const urlsByHash = new Map();

  // A hosted image of this email with the same content is reused when the
  // host still has it in the email's current folder; otherwise the image is
  // put, and remembered. A renamed email, or a changed root folder, gets all
  // of its images in its new folder.
  async function hostedUrlFor(image, content) {
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    if (!urlsByHash.has(hash)) {
      const pending = (async () => {
        const key = {
          _integration: integration._id,
          _mailing: mailingId,
          hash,
        };
        const known = await HostedImages.findOne(key).lean();
        if (known) {
          const file = await host.findFile(known.fileId);
          if (file && String(file.folder) === String(folderId)) return file.url;
        }
        const { id, url } = await host.putImage({
          folderName,
          filename: image.name,
          content,
        });
        await rememberHostedImage({ key, known, fileId: id, url });
        return url;
      })();
      // A failure is not shared: an image of another name retries.
      pending.catch(() => urlsByHash.delete(hash));
      urlsByHash.set(hash, pending);
    }
    return urlsByHash.get(hash);
  }

  const failed = [];
  let hostFailure = null;

  async function worker() {
    while (queue.length) {
      const image = queue.shift();
      try {
        const content = await readSource(image.url);
        const url = await hostedUrlFor(image, content);
        hostedUrls.set(relativeImagePath(image.name), url);
      } catch (error) {
        const failure = hostFailureOf(error);
        if (failure) {
          // Every image would fail alike: stop here.
          hostFailure = hostFailure === 'credentials' ? hostFailure : failure;
          queue.length = 0;
          logger.error('[EXPORT] image host failed', { error: error.message });
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

  if (hostFailure === 'credentials') return refuseCredentials(integration);
  if (hostFailure) throw new BadGateway(ERROR_CODES.IMAGE_HOST_UNAVAILABLE);
  if (failed.length) {
    const error = new BadGateway(ERROR_CODES.IMAGE_HOST_UPLOAD_FAILED);
    error.images = images
      .map((image) => image.url)
      .filter((url) => failed.includes(url));
    throw error;
  }
  return hostedUrls;
}

/**
 * Whether an error is the host's rather than an image's: refused
 * credentials, or a host unreachable, overloaded (429) or failing (5xx). A
 * request the host refused (4xx), or a source that could not be read, is the
 * image's.
 * @returns {'credentials' | 'unavailable' | null}
 */
function hostFailureOf(error) {
  if (!(error instanceof ProviderError)) return null;
  if (error.code === PROVIDER_ERROR_CODES.INVALID_CREDENTIALS) {
    return 'credentials';
  }
  const { status } = error;
  if (!status || status === 429 || status >= 500) return 'unavailable';
  return null;
}

async function refuseCredentials(integration) {
  // Until a tech admin tests it again, the export menu no longer offers it.
  await Integrations.updateOne(
    { _id: integration._id },
    { $set: { validationStatus: 'invalid' } }
  );
  throw new BadGateway(ERROR_CODES.IMAGE_HOST_CREDENTIALS_REFUSED);
}

async function rememberHostedImage({ key, known, fileId, url }) {
  if (known) {
    // Deleted from the host and put back: the record follows the new file.
    await HostedImages.updateOne({ _id: known._id }, { $set: { fileId, url } });
    return;
  }
  try {
    await HostedImages.create({ ...key, fileId, url });
  } catch (error) {
    // Two exports of the email at the same time: the other one remembered
    // it first, and this file is as good as its.
    if (error.code !== 11000) throw error;
  }
}

module.exports = {
  findImageHost,
  emailFolderName,
  putImagesOnHost,
  // exported for testing
  readSource,
};
