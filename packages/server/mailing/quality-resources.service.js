'use strict';

const createError = require('http-errors');

const ERROR_CODES = require('../constant/error-codes.js');
const { probeUrl, PROBE_FAILURES } = require('../utils/url-probe.js');
const blocklists = require('./quality-blocklists.service.js');
const webRisk = require('./quality-web-risk.service.js');
const images = require('./quality-images.service.js');
const {
  cached,
  throttled,
  limiter,
  mapLimited,
  onDefaultPort,
  timeLeft,
  UNVERIFIABLE,
  RUNS_PER_WINDOW,
  clearForTests,
} = require('./quality-limits.js');

/**
 * What the quality checks need from the outside world: whether the links of an
 * email answer, what its images weigh once the export has processed them, and
 * whether a link's domain sits on a blocklist.
 *
 * The editor decides which links and images are the client's (it knows the
 * template); the server only measures them. Any logged-in user can have the
 * server fetch any public address through this, so it is bounded on every
 * side:
 *   - per run: number of addresses, parallel requests, one deadline (what is
 *     left past it is "unverifiable"), a budget of bytes downloaded;
 *   - per user: one run at a time, and 20 runs per 10 minutes;
 *   - for the whole process: a ceiling on link probes and on image downloads
 *     in parallel, and a daily budget of Web Risk lookups per company;
 *   - only the default ports (80, 443), redirects included;
 *   - answers say what a reader would see, never why a request was refused.
 * Definitive answers are cached a few minutes, per company: a re-run after
 * fixing one link should not fetch the forty others again.
 */

const MAX_LINKS = 60;
const MAX_IMAGES = 40;
const MAX_URL_LENGTH = 2048;
const CONCURRENCY = 4;
const LINK_TIMEOUT_MS = 5000;
// Short enough to answer before a hosting router gives up on the request.
const RUN_DEADLINE_MS = 20000;
// Link probes in parallel for the whole process, whoever asks: each user gets
// CONCURRENCY of them, so many users at once must not fan out without end.
const MAX_LINK_PROBES = 16;
const linkProbes = limiter(MAX_LINK_PROBES);
// Web Risk lookups a company may make in a day, past the cache. A run asks
// 60 at most: this lets a company run the checks some fifty times a day, and
// bounds what one account can cost past Google's free tier.
const WEB_RISK_LOOKUPS_PER_DAY = 3000;
const DAY_MS = 24 * 60 * 60 * 1000;

// ----- Payload

function invalid() {
  return new createError.UnprocessableEntity(
    ERROR_CODES.INVALID_QUALITY_RESOURCES
  );
}

function checkUrl(value) {
  if (typeof value !== 'string' || !value || value.length > MAX_URL_LENGTH) {
    throw invalid();
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch (e) {
    throw invalid();
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw invalid();
  }
  // As sent: the editor finds its results back by the address it asked for.
  return value;
}

/**
 * @param {Object} body - `{ links: string[], images: [{ url }] }`
 * @returns {{ links: string[], images: string[] }} distinct, bounded
 * @throws 422 INVALID_QUALITY_RESOURCES on anything else
 */
function validateResourcesPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid();
  const keys = Object.keys(body);
  if (keys.some((key) => key !== 'links' && key !== 'images')) throw invalid();
  const links = body.links || [];
  const images = body.images || [];
  if (!Array.isArray(links) || !Array.isArray(images)) throw invalid();
  if (links.length > MAX_LINKS || images.length > MAX_IMAGES) throw invalid();
  return {
    links: [...new Set(links.map(checkUrl))],
    images: [
      ...new Set(
        images.map((image) => {
          if (!image || typeof image !== 'object') throw invalid();
          return checkUrl(image.url);
        })
      ),
    ],
  };
}

// ----- Links

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

async function checkLink(url, run, deps) {
  if (!onDefaultPort(url) || Date.now() > run.deadline) return UNVERIFIABLE;
  try {
    return linkState(
      await linkProbes(() => {
        if (Date.now() > run.deadline) return Promise.resolve({ status: 0 });
        return deps.probe(url, {
          timeoutMs: timeLeft(run, LINK_TIMEOUT_MS),
          readBody: false,
          defaultPortsOnly: true,
        });
      })
    );
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

// ----- Run

const DEFAULT_DEPS = {
  probe: probeUrl,
  fetchOwn: (url, timeoutMs) => images.fetchOwn(url, timeoutMs),
  resolve4: blocklists.resolve4,
  zones: () => blocklists.blocklistZones(),
  webRiskKey: () => webRisk.apiKey(),
  webRiskLookup: (url, key, options) => webRisk.lookup(url, key, options),
};

const byKey = (keys, values) =>
  keys.reduce((acc, key, i) => {
    acc[key] = values[i];
    return acc;
  }, {});

async function checkDomains(links, zones, key, run, deps) {
  if (!zones.length) return { enabled: false, listed: {} };
  const domains = [
    ...new Set(links.map(blocklists.registrableDomain).filter(Boolean)),
  ];
  const results = await mapLimited(domains, CONCURRENCY, (domain) =>
    // Past the run's deadline, a domain is not judged (and not cached).
    Date.now() > run.deadline
      ? Promise.resolve([])
      : cached(
          key('dnsbl', domain),
          () => blocklists.listedOn(domain, zones, deps.resolve4),
          () => true
        )
  );
  const listed = byKey(domains, results);
  Object.keys(listed).forEach((domain) => {
    if (!listed[domain].length) delete listed[domain];
  });
  return { enabled: true, listed };
}

const webRiskLookups = new Map(); // cacheScope -> { since, count }

// Takes one lookup from the company's daily budget; false once it is spent.
function spendWebRiskLookup(scope) {
  const now = Date.now();
  const budget = webRiskLookups.get(scope);
  if (!budget || now - budget.since > DAY_MS) {
    webRiskLookups.set(scope, { since: now, count: 1 });
    return true;
  }
  if (budget.count >= WEB_RISK_LOOKUPS_PER_DAY) return false;
  budget.count += 1;
  return true;
}

// Google matches an address on its host and path: the query string changes
// nothing to the answer, and `?utm_content=1`, `?utm_content=2`… must not each
// cost a lookup.
function webRiskKeyOf(url) {
  const parsed = new URL(url);
  return `${parsed.origin}${parsed.pathname}`;
}

// Links Google lists as phishing, malware or unwanted software. A failed
// lookup, one past the run's deadline or past the company's daily budget is
// not judged, and not kept for the next runs.
async function checkThreats(links, apiKey, key, run, scope, deps) {
  if (!apiKey) return { enabled: false, threats: {} };
  const results = await mapLimited(links, CONCURRENCY, (url) =>
    cached(
      key('webrisk', webRiskKeyOf(url)),
      () => {
        if (Date.now() > run.deadline || !spendWebRiskLookup(scope)) {
          return Promise.resolve(null);
        }
        return deps.webRiskLookup(url, apiKey, {
          timeoutMs: timeLeft(run, webRisk.TIMEOUT_MS),
        });
      },
      (types) => types !== null
    )
  );
  const threats = byKey(links, results);
  Object.keys(threats).forEach((url) => {
    if (!threats[url] || !threats[url].length) delete threats[url];
  });
  return { enabled: true, threats };
}

/**
 * @param {{ links: string[], images: string[] }} resources - validated
 * @param {Object} context
 * @param {string} context.userKey - one run at a time for this key
 * @param {string} context.cacheScope - answers are shared within this scope
 *   only (the company): another company must not learn what was checked
 * @param {string[]} [context.ownHosts] - the hosts the editor reaches us at
 * @returns {Promise<{ links: Object, images: Object, blocklists: Object,
 *   webRisk: Object }>} results keyed by URL; blocklists: `{ enabled, listed:
 *   { domain: names } }`; webRisk: `{ enabled, threats: { url: types } }`
 */
function checkResources(
  resources,
  { userKey, cacheScope, ownHosts = [] },
  deps = DEFAULT_DEPS
) {
  return throttled(userKey, async () => {
    const run = { deadline: Date.now() + RUN_DEADLINE_MS, bytes: 0 };
    const key = (kind, value) => `${cacheScope}|${kind}|${value}`;

    const [linkResults, imageResults, domains, threats] = await Promise.all([
      mapLimited(resources.links, CONCURRENCY, (url) =>
        cached(
          key('link', url),
          () => checkLink(url, run, deps),
          isDefinitiveLink
        )
      ),
      mapLimited(resources.images, CONCURRENCY, (url) => {
        const target = images.measuredUrl(url, ownHosts);
        // Our own image is keyed by its path: the host that named it is the
        // caller's to choose, and must not decide what another URL reads.
        return cached(
          key('image', target.own ? `own:${target.path}` : url),
          () => images.measureImage(target, run, deps),
          images.isDefinitiveImage
        );
      }),
      checkDomains(resources.links, deps.zones(), key, run, deps),
      checkThreats(
        resources.links,
        deps.webRiskKey(),
        key,
        run,
        cacheScope,
        deps
      ),
    ]);

    return {
      links: byKey(resources.links, linkResults),
      images: byKey(resources.images, imageResults),
      blocklists: domains,
      webRisk: threats,
    };
  });
}

function clearCacheForTests() {
  clearForTests();
  webRiskLookups.clear();
}

module.exports = {
  validateResourcesPayload,
  checkResources,
  linkState,
  MAX_LINKS,
  MAX_IMAGES,
  RUNS_PER_WINDOW,
  WEB_RISK_LOOKUPS_PER_DAY,
  clearCacheForTests,
};
