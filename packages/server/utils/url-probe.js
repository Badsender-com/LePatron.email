'use strict';

const http = require('http');
const https = require('https');
const fetch = require('node-fetch');
const {
  assertOutboundHostAllowed,
  guardedLookup,
  BLOCKED_HOST_ERROR_CODE,
  OUTBOUND_HOST_ERRORS,
} = require('./outbound-host.js');

/**
 * GET requests to addresses a user typed in an email (links, images), for the
 * quality checks. Such an address can point anywhere, so every request goes
 * through the SSRF guard:
 *   - the socket connects to an address `guardedLookup` checked, and a literal
 *     IP is checked by `assertOutboundHostAllowed` before each hop;
 *   - redirects are followed by hand, each new host checked again;
 *   - the whole chain shares one deadline, and the body read is bounded.
 * Nothing is sent but a User-Agent: no cookie, no credential.
 */

const httpAgent = new http.Agent({ lookup: guardedLookup });
const httpsAgent = new https.Agent({ lookup: guardedLookup });
const agentFor = (parsedUrl) =>
  parsedUrl.protocol === 'http:' ? httpAgent : httpsAgent;

const USER_AGENT =
  'Mozilla/5.0 (compatible; LePatron-QualityCheck/1.0; +https://lepatron.email)';

// What went wrong, in words a quality check can turn into a message.
const PROBE_FAILURES = Object.freeze({
  // The name does not exist: the link is broken for every reader.
  NOT_FOUND: 'not-found',
  // No answer in time: maybe slow, maybe down, maybe blocking robots.
  TIMEOUT: 'timeout',
  // An address we refuse to reach (private network, bad scheme).
  REFUSED: 'refused',
  // Too many redirects, a redirect without a target, a connection reset.
  UNREACHABLE: 'unreachable',
  // The body is larger than the caller allows.
  TOO_LARGE: 'too-large',
});

class ProbeError extends Error {
  constructor(reason) {
    super(`URL probe failed: ${reason}`);
    this.reason = reason;
  }
}

// The resolver's answers for a name that does not exist.
const NO_SUCH_NAME = new Set(['ENOTFOUND', 'ENODATA']);

function failureOf(error) {
  if (error instanceof ProbeError) return error;
  const code = error && error.code;
  // Only a name that does not exist: EAI_AGAIN is the resolver failing for a
  // moment, and must not call a link broken.
  if (NO_SUCH_NAME.has(code)) return new ProbeError(PROBE_FAILURES.NOT_FOUND);
  if (
    code === BLOCKED_HOST_ERROR_CODE ||
    code === OUTBOUND_HOST_ERRORS.PRIVATE_ADDRESS ||
    code === OUTBOUND_HOST_ERRORS.INVALID_PROTOCOL ||
    code === OUTBOUND_HOST_ERRORS.INVALID_URL
  ) {
    return new ProbeError(PROBE_FAILURES.REFUSED);
  }
  if (code === OUTBOUND_HOST_ERRORS.DNS_FAILED) {
    // No cause: the name resolved to no address at all.
    const cause = error.cause && error.cause.code;
    return new ProbeError(
      !cause || NO_SUCH_NAME.has(cause)
        ? PROBE_FAILURES.NOT_FOUND
        : PROBE_FAILURES.UNREACHABLE
    );
  }
  if (error && error.name === 'FetchError') {
    if (error.type === 'request-timeout' || error.type === 'body-timeout') {
      return new ProbeError(PROBE_FAILURES.TIMEOUT);
    }
    if (error.type === 'max-size') {
      return new ProbeError(PROBE_FAILURES.TOO_LARGE);
    }
  }
  return new ProbeError(PROBE_FAILURES.UNREACHABLE);
}

const isRedirect = (status) => status >= 300 && status < 400;

// Settles as `promise` does, or fails with TIMEOUT once `deadline` has passed.
function beforeDeadline(promise, deadline) {
  let timer;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(
      () => reject(new ProbeError(PROBE_FAILURES.TIMEOUT)),
      Math.max(1, deadline - Date.now())
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Closes a response without downloading what is left of it.
function dropBody(response) {
  if (response.body && typeof response.body.destroy === 'function') {
    response.body.destroy();
  }
}

/**
 * GETs a URL, following redirects, every hop checked by the SSRF guard.
 *
 * @param {string} url - http or https
 * @param {Object} [options]
 * @param {number} [options.timeoutMs=5000] - for the whole chain and the body
 * @param {number} [options.maxRedirects=5]
 * @param {boolean} [options.readBody=false] - read the body into a Buffer
 * @param {number} [options.maxBytes] - ceiling on the body read
 * @param {Function} [options.fetchImpl] - injectable for tests
 * @returns {Promise<{ status: number, url: string, contentType: string|null,
 *   body: Buffer|null }>}
 * @throws {ProbeError} carrying one of PROBE_FAILURES as `reason`
 */
async function probeUrl(
  url,
  {
    timeoutMs = 5000,
    maxRedirects = 5,
    readBody = false,
    maxBytes = 0,
    fetchImpl = fetch,
  } = {}
) {
  const deadline = Date.now() + timeoutMs;
  let currentUrl = url;
  try {
    for (let hop = 0; ; hop += 1) {
      // A literal IP never goes through guardedLookup. The check resolves the
      // name too, and a lookup has no timeout of its own: the deadline bounds it.
      await beforeDeadline(assertOutboundHostAllowed(currentUrl), deadline);
      const response = await fetchImpl(currentUrl, {
        method: 'GET',
        headers: { 'User-Agent': USER_AGENT, Accept: '*/*' },
        agent: agentFor,
        redirect: 'manual',
        compress: false,
        size: maxBytes,
        timeout: Math.max(1, deadline - Date.now()),
      });
      if (isRedirect(response.status)) {
        dropBody(response);
        const location = response.headers.get('location');
        if (!location || hop >= maxRedirects) {
          throw new ProbeError(PROBE_FAILURES.UNREACHABLE);
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }
      const result = {
        status: response.status,
        url: currentUrl,
        contentType: response.headers.get('content-type'),
        body: null,
      };
      if (readBody && response.ok) result.body = await response.buffer();
      else dropBody(response);
      return result;
    }
  } catch (error) {
    throw failureOf(error);
  }
}

module.exports = { probeUrl, ProbeError, PROBE_FAILURES, USER_AGENT };
