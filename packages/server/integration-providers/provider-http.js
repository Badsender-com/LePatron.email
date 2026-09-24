'use strict';

const http = require('http');
const https = require('https');
const fetch = require('node-fetch');
const {
  assertOutboundHostAllowed,
  guardedLookup,
  BLOCKED_HOST_ERROR_CODE,
} = require('../utils/outbound-host.js');
const {
  ProviderError,
  PROVIDER_ERROR_CODES: CODES,
} = require('./provider-error.js');

/**
 * Outbound HTTP for providers, with the guards that must not be optional.
 * These requests carry the integration's API key to a host a group admin
 * chose, so providers must not call node-fetch directly.
 *
 *   - The socket connects to an address that was checked. The agents resolve
 *     through `guardedLookup`: checking the host beforehand and letting the
 *     request resolve it again is what DNS rebinding exploits.
 *   - Redirects are refused, not followed. node-fetch follows them without
 *     re-checking the host, and it only strips `authorization` and cookies on
 *     the way: `x-api-key`, `api-key` and friends would reach the new host in
 *     clear. No provider API answers with a redirect, so refusing costs
 *     nothing.
 *   - The body is bounded in size and in time. node-fetch's `size` and
 *     `timeout` both apply while the body is read, where an AbortController
 *     cleared once the headers arrive does not. The process is shared by
 *     every group: one endpoint answering gigabytes, or a byte a minute, must
 *     not take it down.
 */

const httpAgent = new http.Agent({ lookup: guardedLookup });
const httpsAgent = new https.Agent({ lookup: guardedLookup });

// A model listing is a few hundred kilobytes at most (OpenAI's, the largest,
// is well under 100 KB).
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;

// Short on purpose: listings and credential checks run while a group admin
// waits on the settings screen, and a slow provider must degrade to the
// catalogue rather than hang the page. Applies to the headers and to the body
// read, each.
const LISTING_TIMEOUT_MS = 5000;

function agentFor(parsedUrl) {
  return parsedUrl.protocol === 'http:' ? httpAgent : httpsAgent;
}

/**
 * Translate a network-level failure into our error vocabulary.
 *
 * The message names the kind of failure and never the address: it may reach
 * the client, and "ECONNREFUSED 10.0.0.12:9200" is a port scanner's answer.
 */
function toProviderError(error, label) {
  if (error instanceof ProviderError) return error;
  // A caller-owned signal aborting is the caller's business (its own timeout).
  if (error && error.name === 'AbortError') return error;

  if (error && error.name === 'FetchError') {
    if (error.type === 'request-timeout' || error.type === 'body-timeout') {
      return new ProviderError(`${label}: timed out`, CODES.TIMEOUT);
    }
    if (error.type === 'max-size' || error.type === 'invalid-json') {
      return new ProviderError(
        `${label}: unusable response (${error.type})`,
        CODES.INVALID_RESPONSE
      );
    }
    if (error.code === BLOCKED_HOST_ERROR_CODE) {
      return new ProviderError(
        `${label}: host resolves to a disallowed address`,
        CODES.CONFIG_ERROR
      );
    }
    return new ProviderError(
      `${label}: unreachable (${error.code || error.type})`,
      CODES.API_ERROR
    );
  }

  // assertOutboundHostAllowed throws plain errors with our own wording.
  return new ProviderError(
    `${label}: ${(error && error.message) || 'request failed'}`,
    CODES.CONFIG_ERROR
  );
}

/** Default reading of an HTTP status, for providers speaking OpenAI's. */
function mapHttpStatusToCode(status) {
  if (status === 401) return CODES.INVALID_CREDENTIALS;
  if (status === 429) return CODES.QUOTA_EXCEEDED;
  return CODES.API_ERROR;
}

/**
 * @param {string} url
 * @param {Object} options
 * @param {string} [options.method='GET']
 * @param {Object} options.headers
 * @param {string} [options.body]
 * @param {number} [options.timeoutMs] applies to the headers and to the body
 * @param {number} [options.maxBytes] ceiling on the body size
 * @param {AbortSignal} [options.signal] caller-owned signal, honoured as well
 * @param {string} [options.label='provider'] names the call in errors
 * @returns {Promise<Response>}
 * @throws {ProviderError} on a refused host, a redirect or a network failure
 */
async function guardedFetch(
  url,
  {
    method = 'GET',
    headers,
    body,
    timeoutMs = 0,
    maxBytes = DEFAULT_MAX_BYTES,
    signal,
    label = 'provider',
  } = {}
) {
  let response;
  try {
    // Still needed alongside guardedLookup: a literal IP host never goes
    // through a DNS lookup.
    await assertOutboundHostAllowed(url);
    response = await fetch(url, {
      method,
      headers,
      body,
      agent: agentFor,
      redirect: 'manual',
      size: maxBytes,
      timeout: timeoutMs,
      signal,
    });
  } catch (error) {
    throw toProviderError(error, label);
  }

  if (response.status >= 300 && response.status < 400) {
    throw new ProviderError(
      `${label}: answered with a redirect (${response.status}), not followed`,
      CODES.API_ERROR
    );
  }
  return response;
}

/**
 * GET a provider endpoint and return its parsed JSON, the body read included
 * in the size and time bounds.
 *
 * @param {string} url
 * @param {Object} options
 * @param {Object} options.headers
 * @param {string} options.label     provider call, for the error message
 * @param {Function} [options.mapErrorToCode] status → PROVIDER_ERROR_CODES
 * @param {number} [options.timeoutMs]
 * @param {number} [options.maxBytes]
 * @returns {Promise<Object>} the parsed body
 * @throws {ProviderError} on any non-2xx, or when the body is unusable
 */
async function fetchProviderJson(
  url,
  {
    headers,
    label,
    mapErrorToCode = mapHttpStatusToCode,
    timeoutMs = LISTING_TIMEOUT_MS,
    maxBytes = DEFAULT_MAX_BYTES,
  } = {}
) {
  const response = await guardedFetch(url, {
    method: 'GET',
    headers,
    timeoutMs,
    maxBytes,
    label,
  });

  if (!response.ok) {
    throw new ProviderError(
      `${label} request failed: ${response.status}`,
      mapErrorToCode(response.status)
    );
  }

  try {
    return await response.json();
  } catch (error) {
    throw toProviderError(error, label);
  }
}

module.exports = {
  guardedFetch,
  fetchProviderJson,
  toProviderError,
  mapHttpStatusToCode,
  LISTING_TIMEOUT_MS,
  DEFAULT_MAX_BYTES,
};
