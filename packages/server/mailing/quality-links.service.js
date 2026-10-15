'use strict';

const { probeUrl, PROBE_FAILURES } = require('../utils/url-probe.js');
const {
  limiter,
  onDefaultPort,
  withoutCredentials,
  timeLeft,
  UNVERIFIABLE,
} = require('./quality-limits.js');

/**
 * Whether the links of an email answer, for the quality checks
 * (quality-resources.service.js): each one is fetched through the SSRF guard
 * and read as a reader would meet it.
 */

const LINK_TIMEOUT_MS = 5000;
// Link probes in parallel for the worker, whoever asks: each user gets
// CONCURRENCY of them, so many users at once must not fan out without end
// (×WORKERS for the instance, see quality-limits.js).
const MAX_LINK_PROBES = 16;
const linkProbes = limiter(MAX_LINK_PROBES);

/**
 * How a link answers:
 *   - ok: a 2xx at the end of the redirects;
 *   - broken: the page is gone (404, 410), or the server fails on it (500).
 *     Every reader would hit it;
 *   - unverifiable: anything a robot meets and a reader may not: 401, 403,
 *     429, 503 (Cloudflare's challenge), 502 and 504 (a proxy having a bad
 *     moment), LinkedIn's 999. Only worth a look.
 */
function linkState({ status }) {
  if (status >= 200 && status < 300) return { state: 'ok', httpStatus: status };
  if (status === 404 || status === 410 || status === 500) {
    return { state: 'broken', httpStatus: status };
  }
  return { state: 'unverifiable', httpStatus: status };
}

async function checkLink(url, run, deps = { probe: probeUrl }) {
  if (!onDefaultPort(url) || Date.now() > run.deadline) return UNVERIFIABLE;
  try {
    const response = await linkProbes(() =>
      // The deadline may pass while waiting for a probe slot: not judged.
      Date.now() > run.deadline
        ? null
        : deps.probe(withoutCredentials(url), {
            timeoutMs: timeLeft(run, LINK_TIMEOUT_MS),
            readBody: false,
            defaultPortsOnly: true,
          })
    );
    return response ? linkState(response) : UNVERIFIABLE;
  } catch (error) {
    if (error.reason === PROBE_FAILURES.NOT_FOUND) {
      return { state: 'broken', reason: error.reason };
    }
    if (error.reason === PROBE_FAILURES.TIMEOUT) {
      return { state: 'unverifiable', reason: error.reason };
    }
    // Refused (a private network), reset, too many redirects: the answer does
    // not say which, or it would map what the server can reach.
    return UNVERIFIABLE;
  }
}

// Kept for the next runs: a page that answers or is gone, a domain that does
// not exist. A server error or a refusal may change within minutes.
const isDefinitiveLink = (result) =>
  result.state === 'ok' ||
  result.httpStatus === 404 ||
  result.httpStatus === 410 ||
  result.reason === PROBE_FAILURES.NOT_FOUND;

module.exports = { checkLink, linkState, isDefinitiveLink, MAX_LINK_PROBES };
