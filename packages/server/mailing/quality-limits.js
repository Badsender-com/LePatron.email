'use strict';

const async = require('async');
const { promisify } = require('util');
const createError = require('http-errors');

const ERROR_CODES = require('../constant/error-codes.js');
const { windowCounter } = require('../utils/window-counter.js');

/**
 * The limits around the quality checks the server runs (quality-resources
 * .service.js): a shared cache of answers, one run at a time and a few runs
 * per window for each user, and semaphores.
 *
 * Everything here is in memory, so per worker: index.js runs one process per
 * WORKERS, and each has its own cache, its own queue and its own counts. The
 * per-user limits hold ×WORKERS in the worst case (two requests of one user
 * landing on two workers), which still stops a script; only the Web Risk
 * budget, the one that costs money, is shared through the database
 * (quality-threats.service.js). quality-resources.service.js logs the
 * effective bounds when a worker starts.
 */

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 5000;
const RUNS_PER_WINDOW = 20;
const RUN_WINDOW_MS = 10 * 60 * 1000;
// Requests of one kind in parallel within a run.
const CONCURRENCY = 4;

const cache = new Map();

/**
 * Shares one answer per key, for `ttlMs`. Only a definitive one is kept for
 * the next runs: a timeout, a server error or a run past its deadline is
 * asked again.
 *
 * A run that finds an answer in flight waits for it, and that answer was
 * bounded by the deadline of the run that asked first: a second run joining
 * late may receive "unverifiable" for it, and asks again next time (such an
 * answer is not definitive). Accepted: the alternative is asking twice.
 */
function cached(key, compute, isDefinitive, ttlMs = CACHE_TTL_MS) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = compute();
  if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expires: Date.now() + ttlMs });
  value.then(
    (result) => {
      if (!isDefinitive(result)) cache.delete(key);
    },
    () => cache.delete(key)
  );
  return value;
}

const runs = new Map(); // userKey -> { done: Promise, waiting: boolean }
const recentRuns = windowCounter({
  windowMs: RUN_WINDOW_MS,
  limit: RUNS_PER_WINDOW,
});

const settled = (promise) => promise.then(noop, noop);
function noop() {}

/**
 * One run at a time per user, and RUNS_PER_WINDOW runs per RUN_WINDOW_MS.
 *
 * A second run of the same user (a second tab, an export during a run) waits
 * for the first one rather than being refused: QUALITY_CHECK_RUNNING is
 * answered only when a run is already waiting. QUALITY_CHECKS_TOO_FREQUENT
 * counts every run that got in, waiting ones included.
 */
async function throttled(userKey, work) {
  const previous = runs.get(userKey);
  if (previous && previous.waiting) {
    throw new createError.TooManyRequests(ERROR_CODES.QUALITY_CHECK_RUNNING);
  }
  if (!recentRuns.hit(userKey)) {
    throw new createError.TooManyRequests(
      ERROR_CODES.QUALITY_CHECKS_TOO_FREQUENT
    );
  }
  const slot = { waiting: Boolean(previous), done: null };
  slot.done = (async () => {
    if (previous) await settled(previous.done);
    slot.waiting = false;
    return work();
  })();
  runs.set(userKey, slot);
  try {
    return await slot.done;
  } finally {
    if (runs.get(userKey) === slot) runs.delete(userKey);
  }
}

// A semaphore: at most `limit` tasks at once, whoever asks. Per worker.
function limiter(limit) {
  let active = 0;
  const waiting = [];
  return async (task) => {
    if (active >= limit) await new Promise((resolve) => waiting.push(resolve));
    active += 1;
    try {
      return await task();
    } finally {
      active -= 1;
      if (waiting.length) waiting.shift()();
    }
  };
}

const mapLimit = promisify(async.mapLimit);

// Runs `task` on every item, `limit` at a time, results in the items' order.
const mapLimited = (items, limit, task) =>
  mapLimit(items, limit, async.asyncify(task));

// Emails link to web pages: another port is a service, not a page.
const onDefaultPort = (url) => new URL(url).port === '';

// What is fetched: the address without the credentials its author may have
// typed in it, which the server would otherwise present to a third party.
function withoutCredentials(url) {
  const parsed = new URL(url);
  if (!parsed.username && !parsed.password) return url;
  parsed.username = '';
  parsed.password = '';
  return parsed.toString();
}

// What is not judged: out of time, refused, or a hint of bot protection.
const UNVERIFIABLE = Object.freeze({ state: 'unverifiable' });

// A request's time: its own ceiling, never past the run's deadline.
const timeLeft = (run, ceiling) =>
  Math.min(ceiling, Math.max(1, run.deadline - Date.now()));

function clearForTests() {
  cache.clear();
  runs.clear();
  recentRuns.clear();
}

module.exports = {
  cached,
  throttled,
  limiter,
  mapLimited,
  onDefaultPort,
  withoutCredentials,
  timeLeft,
  UNVERIFIABLE,
  CONCURRENCY,
  RUNS_PER_WINDOW,
  RUN_WINDOW_MS,
  clearForTests,
};
