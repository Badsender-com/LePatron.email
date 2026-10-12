'use strict';

const axios = require('axios');

// The request for the server's checks (links, image weight), with what the
// review needs around it: a way to abort it, and the retry a 429 deserves.

// The server answers within 20 s (quality-resources.service.js): past this,
// something went wrong on the way.
const RESOURCES_TIMEOUT_MS = 40000;
// The server runs one check at a time per user, for up to 20 s: another tab
// (or an export reviewed during a run) is asked again every few seconds until
// that run is over, and gives up a little past its longest duration.
const RETRY_DELAY_MS = 3000;
const RETRY_WINDOW_MS = 25000;

// Error codes of packages/server/constant/error-codes.js, as the API error
// handler ships them (`message`).
const CHECK_RUNNING = 'QUALITY_CHECK_RUNNING';
const CHECKS_TOO_FREQUENT = 'QUALITY_CHECKS_TOO_FREQUENT';

function errorCodeOf(err) {
  const data = err && err.response && err.response.data;
  return (data && (data.message || data.error)) || null;
}

const isRunningElsewhere = (err) =>
  Boolean(err && err.response && err.response.status === 429) &&
  errorCodeOf(err) === CHECK_RUNNING;

/** Whether the server refused because the user ran too many checks. */
const isTooFrequent = (err) =>
  Boolean(err && err.response && err.response.status === 429) &&
  errorCodeOf(err) === CHECKS_TOO_FREQUENT;

/** A handle to abort the request: `{ token, cancel() }`. */
function createCancel() {
  const source = axios.CancelToken.source();
  return { token: source.token, cancel: () => source.cancel('cancelled') };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Asks the server about the links and images; resolves with its answer.
 * @param {string} url
 * @param {Object} resources - `{ links, images }`
 * @param {Object} [options]
 * @param {Object} [options.cancelToken] - from `createCancel().token`
 * @param {Function} [options.delay] - injectable for tests
 * @param {Function} [options.now] - injectable for tests
 */
function postResources(url, resources, options = {}) {
  const { cancelToken, delay = wait, now = Date.now } = options;
  const deadline = now() + RETRY_WINDOW_MS;
  const attempt = () =>
    axios
      .post(url, resources, { timeout: RESOURCES_TIMEOUT_MS, cancelToken })
      .then((response) => response.data)
      .catch((err) => {
        if (!isRunningElsewhere(err) || now() >= deadline) throw err;
        return delay(RETRY_DELAY_MS).then(() => {
          // Cancelled while waiting: axios would only notice on the next send.
          if (cancelToken && cancelToken.reason) throw cancelToken.reason;
          return attempt();
        });
      });
  return attempt();
}

module.exports = {
  postResources,
  createCancel,
  isTooFrequent,
  isCancel: axios.isCancel,
  RETRY_DELAY_MS,
  RETRY_WINDOW_MS,
};
