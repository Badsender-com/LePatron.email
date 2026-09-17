'use strict';

const fetch = require('node-fetch');
const AbortController = require('abort-controller');
const { assertOutboundHostAllowed } = require('../utils/outbound-host.js');
const {
  ProviderError,
  PROVIDER_ERROR_CODES: CODES,
} = require('./provider-error.js');

/**
 * Outbound HTTP for providers, with the guards that must not be optional.
 *
 * The SSRF guard validates the host we are about to call — and stops there.
 * node-fetch follows redirects on its own, without re-checking, so a public
 * host answering `302 Location: http://169.254.169.254/…` walks straight past
 * it. Worse, node-fetch only strips `authorization`, `www-authenticate` and
 * the cookie headers when a redirect crosses hosts (see its lib/index.js):
 * `x-api-key` (Anthropic), `x-goog-api-key` (Gemini) and `api-key` (Azure)
 * survive, so the redirect target receives the key in clear.
 *
 * Redirects are therefore followed here, one hop at a time, re-validating the
 * host each time. Providers must not call fetch directly.
 */

const MAX_REDIRECTS = 5;

/**
 * @param {string} url
 * @param {Object} options
 * @param {string} [options.method='GET']
 * @param {Object} options.headers
 * @param {string} [options.body]
 * @param {number} options.timeoutMs
 * @param {AbortSignal} [options.signal] caller-owned signal, honoured as well
 * @returns {Promise<Response>}
 */
async function guardedFetch(
  url,
  { method = 'GET', headers, body, timeoutMs, signal } = {}
) {
  let currentUrl = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    // Re-validated on every hop, and immediately before the request: DNS may
    // have changed since the integration was saved (TOCTOU).
    await assertOutboundHostAllowed(currentUrl);

    const controller = new AbortController();
    const timeoutId = timeoutMs
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;
    const onAbort = () => controller.abort();
    if (signal) signal.addEventListener('abort', onAbort);

    let response;
    try {
      response = await fetch(currentUrl, {
        method,
        headers,
        body,
        // The whole point: never let node-fetch follow one unchecked.
        redirect: 'manual',
        signal: controller.signal,
      });
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      if (signal) signal.removeEventListener('abort', onAbort);
    }

    // Anything that is not unambiguously a redirect is handed back as is.
    // Deliberately defensive: treating an unexpected response as a redirect
    // would send the next request — and the API key — somewhere we never
    // validated.
    const status = response.status;
    const isRedirect =
      typeof status === 'number' && status >= 300 && status < 400;
    if (!isRedirect) return response;

    const location =
      response.headers && typeof response.headers.get === 'function'
        ? response.headers.get('location')
        : null;
    if (!location) return response;

    currentUrl = new URL(location, currentUrl).toString();
  }

  throw new ProviderError(`Too many redirects from ${url}`, CODES.API_ERROR);
}

module.exports = { guardedFetch, MAX_REDIRECTS };
