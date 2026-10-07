'use strict';

const fetch = require('node-fetch');
const probeImageSize = require('probe-image-size');

const config = require('../node.config.js');
const { PROBE_FAILURES } = require('../utils/url-probe.js');
const {
  limiter,
  onDefaultPort,
  timeLeft,
  UNVERIFIABLE,
} = require('./quality-limits.js');

/**
 * Weighs an image of an email as the export ships it, for the quality checks
 * (quality-resources.service.js): its size in bytes and its dimensions.
 */

const IMAGE_TIMEOUT_MS = 10000;
// Past this, an image is "at least" this heavy: enough to say it is too heavy.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const RUN_IMAGE_BUDGET_BYTES = 50 * 1024 * 1024;
// Image downloads in parallel for the whole process, every user included:
// bodies are buffered, so this bounds the memory the checks can take.
const MAX_IMAGE_DOWNLOADS = 8;

const imageDownloads = limiter(MAX_IMAGE_DOWNLOADS);

// The addresses the export gets our images at: the image itself, or its
// resized or cropped version (image.routes.js). Never a placeholder, never
// the gallery.
const OWN_IMAGE_PATH = /^\/api\/images\/(?:(?:resize|cover)\/(?:\d{1,4}|null)x(?:\d{1,4}|null)\/)?[^/]+$/;

/**
 * The address to measure an image at. Images of LePatron's own backend are
 * what the export downloads and ships (resized, cropped: the export fetches
 * those very URLs), so they are measured the same way, but asked of this
 * process directly. Only the path is kept, without its query: the host the
 * request named is never contacted.
 * @param {string[]} ownHosts - the hosts the editor reaches us at
 */
function measuredUrl(url, ownHosts) {
  const parsed = new URL(url);
  if (ownHosts.includes(parsed.host) && OWN_IMAGE_PATH.test(parsed.pathname)) {
    return {
      own: true,
      path: parsed.pathname,
      url: `http://127.0.0.1:${config.PORT}${parsed.pathname}`,
    };
  }
  return { own: false, url };
}

// Our own backend, on the loopback: no SSRF guard (it would refuse 127.0.0.1),
// a fixed host and a path limited to /api/images/. Outside development the
// server sends any plain-http request to https (index.js, FORCE HTTPS): this
// one says it came through https, as the export's request does at the proxy.
async function fetchOwn(url, timeoutMs, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    headers: { 'X-Forwarded-Proto': 'https' },
    redirect: 'manual',
    size: MAX_IMAGE_BYTES,
    timeout: timeoutMs,
  });
  if (!response.ok) {
    if (response.body && response.body.destroy) response.body.destroy();
    return { status: response.status, body: null };
  }
  return { status: response.status, body: await response.buffer() };
}

function dimensionsOf(buffer) {
  try {
    const { width, height, type } = probeImageSize.sync(buffer) || {};
    return width ? { width, height, type } : {};
  } catch (e) {
    return {};
  }
}

function download(target, run, deps) {
  const timeoutMs = timeLeft(run, IMAGE_TIMEOUT_MS);
  return target.own
    ? deps.fetchOwn(target.url, timeoutMs)
    : deps.probe(target.url, {
        timeoutMs,
        readBody: true,
        maxBytes: MAX_IMAGE_BYTES,
        defaultPortsOnly: true,
      });
}

// Out of time, or out of bytes for this run: the rest is not judged.
const outOfBudget = (run) =>
  Date.now() > run.deadline || run.bytes >= RUN_IMAGE_BUDGET_BYTES;

// The image is missing where the export will look for it: gone (4xx) or on a
// domain that does not exist. Anything else may well work for the export.
const isMissing = (status) => status >= 400 && status < 500;

async function measureImage(target, run, deps) {
  if (!target.own && !onDefaultPort(target.url)) return UNVERIFIABLE;
  return imageDownloads(async () => {
    if (outOfBudget(run)) return UNVERIFIABLE;
    try {
      const response = await download(target, run, deps);
      if (!response.body) {
        return isMissing(response.status)
          ? { state: 'unreachable', httpStatus: response.status }
          : UNVERIFIABLE;
      }
      run.bytes += response.body.length;
      return {
        state: 'ok',
        bytes: response.body.length,
        ...dimensionsOf(response.body),
      };
    } catch (error) {
      const tooLarge =
        error.reason === PROBE_FAILURES.TOO_LARGE ||
        (error.name === 'FetchError' && error.type === 'max-size');
      if (tooLarge) {
        run.bytes += MAX_IMAGE_BYTES;
        return { state: 'ok', bytes: MAX_IMAGE_BYTES, atLeast: true };
      }
      if (error.reason === PROBE_FAILURES.NOT_FOUND) {
        return { state: 'unreachable', reason: error.reason };
      }
      // Refused (a private network), too slow, reset: not judged.
      return UNVERIFIABLE;
    }
  });
}

// Kept for the next runs: a weight, or the image being gone.
const isDefinitiveImage = (result) => result.state !== 'unverifiable';

module.exports = {
  measuredUrl,
  measureImage,
  fetchOwn,
  isDefinitiveImage,
  MAX_IMAGE_BYTES,
};
