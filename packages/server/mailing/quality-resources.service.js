'use strict';

const createError = require('http-errors');
const { zipObject } = require('lodash');

const ERROR_CODES = require('../constant/error-codes.js');
const logger = require('../utils/logger.js');
const { probeUrl } = require('../utils/url-probe.js');
const { workerCount } = require('../utils/worker-count.js');
const blocklists = require('./quality-blocklists.service.js');
const webRisk = require('./quality-web-risk.service.js');
const images = require('./quality-images.service.js');
const links = require('./quality-links.service.js');
const threats = require('./quality-threats.service.js');
const {
  cached,
  throttled,
  mapLimited,
  CONCURRENCY,
  RUNS_PER_WINDOW,
  RUN_WINDOW_MS,
  clearForTests,
} = require('./quality-limits.js');

/**
 * What the quality checks need from the outside world: whether the links of an
 * email answer (quality-links.service.js), what its images weigh once the
 * export has processed them (quality-images.service.js), and what blocklists
 * and Google Web Risk say of its links (quality-threats.service.js). This
 * module validates what the editor sends, and runs the four within the bounds.
 *
 * The editor decides which links and images are the client's (it knows the
 * template); the server only measures them. Any logged-in user can have the
 * server fetch any public address through this, so it is bounded on every
 * side:
 *   - per run: number of addresses, parallel requests, one deadline (what is
 *     left past it is "unverifiable"), a budget of bytes downloaded;
 *   - per user: one run at a time (a second one waits a few seconds), and 20
 *     runs per 10 minutes;
 *   - per worker: a ceiling on link probes and on image downloads in
 *     parallel (every in-memory bound is per worker, see quality-limits.js);
 *   - for the whole cluster: a daily budget of Web Risk lookups per company,
 *     and a quarter of it per user, in the database;
 *   - only the default ports (80, 443), redirects included;
 *   - answers say what a reader would see, never why a request was refused.
 * Definitive answers are cached a few minutes, per company: a re-run after
 * fixing one link should not fetch the forty others again.
 */

const { RESOURCES } = require('../../shared/quality/limits.js');

const MAX_LINKS = RESOURCES.maxLinks;
const MAX_IMAGES = RESOURCES.maxImages;
const MAX_URL_LENGTH = RESOURCES.maxUrlLength;
// Short enough to answer before a hosting router gives up on the request.
const RUN_DEADLINE_MS = 20000;

// The editor's checks this run serves, and what each has the server do: visit
// the links, ask Web Risk, ask the blocklists, download the images.
const REMOTE_CHECKS = Object.freeze({
  'broken-links': 'linkProbes',
  'dangerous-links': 'webRisk',
  'domain-blocklists': 'blocklists',
  'image-weight': 'images',
  'images-total-weight': 'images',
  'oversized-images': 'images',
});
const ALL_TASKS = Object.freeze({
  linkProbes: true,
  webRisk: true,
  blocklists: true,
  images: true,
});

/**
 * What a run does for the checks the editor names; everything when it names
 * none (an editor from before the list).
 * @param {string[]} [checks]
 * @returns {{ linkProbes: boolean, webRisk: boolean, blocklists: boolean,
 *   images: boolean }}
 */
function tasksOf(checks) {
  if (!checks) return ALL_TASKS;
  const tasks = new Set(checks.map((id) => REMOTE_CHECKS[id]));
  return Object.fromEntries(
    Object.keys(ALL_TASKS).map((task) => [task, tasks.has(task)])
  );
}

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
  // As sent, credentials included: the editor finds its results back by the
  // address it asked for. What is fetched is `withoutCredentials(value)`.
  return value;
}

function checkIds(value) {
  if (!Array.isArray(value)) throw invalid();
  value.forEach((id) => {
    if (typeof id !== 'string' || !Object.hasOwn(REMOTE_CHECKS, id)) {
      throw invalid();
    }
  });
  return [...new Set(value)];
}

const PAYLOAD_KEYS = ['links', 'images', 'checks'];

/**
 * @param {Object} body - `{ links: string[], images: [{ url }], checks? }`,
 *   `checks` the editor's checks that are on among REMOTE_CHECKS
 * @returns {{ links: string[], images: string[], checks?: string[] }}
 *   distinct, bounded; `checks` only when sent
 * @throws 422 INVALID_QUALITY_RESOURCES on anything else
 */
function validateResourcesPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid();
  const keys = Object.keys(body);
  if (keys.some((key) => !PAYLOAD_KEYS.includes(key))) throw invalid();
  const links = body.links || [];
  const images = body.images || [];
  if (!Array.isArray(links) || !Array.isArray(images)) throw invalid();
  if (links.length > MAX_LINKS || images.length > MAX_IMAGES) throw invalid();
  const checks =
    body.checks === undefined ? {} : { checks: checkIds(body.checks) };
  return {
    ...checks,
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

// ----- Run

const DEFAULT_DEPS = {
  probe: probeUrl,
  fetchOwn: (url, options) => images.fetchOwn(url, options),
  resolve4: blocklists.resolve4,
  zones: () => blocklists.blocklistZones(),
  webRiskKey: () => webRisk.apiKey(),
  webRiskLookup: (url, key, options) => webRisk.lookup(url, key, options),
  spendWebRiskLookup: (scope) => threats.spendWebRiskLookup(scope),
};

// Said once per worker: the in-memory bounds hold per worker (index.js runs
// WORKERS of them, counted as it does), the Web Risk budget for the cluster.
// index.js loads the routes in its master too, which serves nothing: silent.
function logBounds() {
  logger.log('[QUALITY] resource check bounds', {
    workers: workerCount(),
    perWorker: {
      runsPerUser: `${RUNS_PER_WINDOW} per ${RUN_WINDOW_MS / 60000} min`,
      linkProbes: links.MAX_LINK_PROBES,
      imageDownloads: images.MAX_IMAGE_DOWNLOADS,
    },
    perRun: { deadlineMs: RUN_DEADLINE_MS, concurrency: CONCURRENCY },
    shared: {
      webRiskLookupsPerCompanyPerDay: threats.WEB_RISK_LOOKUPS_PER_DAY,
      webRiskLookupsPerUserPerDay: threats.WEB_RISK_LOOKUPS_PER_USER_PER_DAY,
    },
  });
}
if (require('cluster').isWorker) logBounds();

// A run whose caller is gone (the editor replaced it, the tab closed) is cut
// short: its deadline is brought to now, so nothing more is fetched for it.
// What is in flight ends on its own timeout.
function cutShortOnAbort(run, signal) {
  if (!signal) return;
  const cut = () => {
    run.deadline = 0;
  };
  if (signal.aborted) cut();
  else signal.addEventListener('abort', cut, { once: true });
}

/**
 * Only what the named checks need is done: no link is visited without
 * "broken-links", no Web Risk lookup without "dangerous-links", no blocklist
 * query without "domain-blocklists", no image downloaded without an image
 * check. What is skipped answers as a check that has not run.
 *
 * @param {{ links: string[], images: string[], checks?: string[] }} resources
 *   validated
 * @param {Object} context
 * @param {string} context.userKey - one run at a time for this key
 * @param {string} context.cacheScope - answers are shared within this scope
 *   only (the company): another company must not learn what was checked
 * @param {string[]} [context.ownHosts] - the hosts the editor reaches us at
 * @param {AbortSignal} [context.signal] - aborted once the caller is gone
 * @returns {Promise<{ links: Object, images: Object, blocklists: Object,
 *   webRisk: Object }>} results keyed by URL; blocklists: `{ enabled, listed:
 *   { domain: names }, unchecked: domains }`; webRisk: `{ enabled, threats:
 *   { url: types }, unchecked: urls }`
 */
function checkResources(
  resources,
  { userKey, cacheScope, ownHosts = [], signal },
  deps = DEFAULT_DEPS
) {
  // From the arrival of the request, waiting for a turn included: the editor
  // gives up after its own timeout, whatever the server was doing.
  const run = { deadline: Date.now() + RUN_DEADLINE_MS, bytes: 0 };
  cutShortOnAbort(run, signal);
  return throttled(userKey, async () => {
    const key = (kind, value) => `${cacheScope}|${kind}|${value}`;
    const tasks = tasksOf(resources.checks);
    const probed = tasks.linkProbes ? resources.links : [];
    const measured = tasks.images ? resources.images : [];

    const [linkResults, imageResults, domains, dangerous] = await Promise.all([
      mapLimited(probed, CONCURRENCY, (url) =>
        cached(
          key('link', url),
          () => links.checkLink(url, run, deps),
          links.isDefinitiveLink
        )
      ),
      mapLimited(measured, CONCURRENCY, (url) => {
        const target = images.measuredUrl(url, ownHosts);
        // Our own image is keyed by its path: the host that named it is the
        // caller's to choose, and must not decide what another URL reads.
        return cached(
          key('image', target.own ? `own:${target.path}` : url),
          () => images.measureImage(target, run, deps),
          images.isDefinitiveImage,
          target.own ? images.OWN_IMAGE_TTL_MS : undefined
        );
      }),
      // Without zones or a key, each answers as a check that has not run.
      threats.checkDomains(
        resources.links,
        tasks.blocklists ? deps.zones() : [],
        key,
        run,
        deps
      ),
      threats.checkThreats(
        resources.links,
        tasks.webRisk ? deps.webRiskKey() : null,
        key,
        run,
        { company: cacheScope, user: userKey },
        deps
      ),
    ]);

    return {
      links: zipObject(probed, linkResults),
      images: zipObject(measured, imageResults),
      blocklists: domains,
      webRisk: dangerous,
    };
  });
}

function clearCacheForTests() {
  clearForTests();
}

module.exports = {
  validateResourcesPayload,
  checkResources,
  MAX_LINKS,
  MAX_IMAGES,
  RUNS_PER_WINDOW,
  clearCacheForTests,
};
