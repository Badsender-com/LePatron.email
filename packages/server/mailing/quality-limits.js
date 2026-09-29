'use strict';

const createError = require('http-errors');

const ERROR_CODES = require('../constant/error-codes.js');

/**
 * The limits around the quality checks the server runs (quality-resources
 * .service.js): a shared cache of answers, one run at a time and a few runs
 * per window for each user, and semaphores.
 */

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 5000;
const RUNS_PER_WINDOW = 20;
const RUN_WINDOW_MS = 10 * 60 * 1000;

const cache = new Map();

/**
 * Shares one answer per key. Only a definitive one is kept for the next runs:
 * a timeout, a server error or a run past its deadline is asked again.
 */
function cached(key, compute, isDefinitive) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = compute();
  if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
  value.then(
    (result) => {
      if (!isDefinitive(result)) cache.delete(key);
    },
    () => cache.delete(key)
  );
  return value;
}

const running = new Set();
const recentRuns = new Map();

/**
 * One run at a time per user, and RUNS_PER_WINDOW runs per RUN_WINDOW_MS: the
 * editor queues its requests, so only a script ever meets either limit.
 */
async function throttled(userKey, work) {
  if (running.has(userKey)) {
    throw new createError.TooManyRequests(ERROR_CODES.QUALITY_CHECK_RUNNING);
  }
  const now = Date.now();
  const runs = (recentRuns.get(userKey) || []).filter(
    (at) => at > now - RUN_WINDOW_MS
  );
  if (runs.length >= RUNS_PER_WINDOW) {
    throw new createError.TooManyRequests(
      ERROR_CODES.QUALITY_CHECKS_TOO_FREQUENT
    );
  }
  recentRuns.set(userKey, runs.concat(now));
  running.add(userKey);
  try {
    return await work();
  } finally {
    running.delete(userKey);
  }
}

// A semaphore: at most `limit` tasks at once, whoever asks.
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

// Runs `task` on every item, `limit` at a time.
async function mapLimited(items, limit, task) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  );
  return results;
}

// Emails link to web pages: another port is a service, not a page.
const onDefaultPort = (url) => new URL(url).port === '';

// What is not judged: out of time, refused, or a hint of bot protection.
const UNVERIFIABLE = Object.freeze({ state: 'unverifiable' });

// A request's time: its own ceiling, never past the run's deadline.
const timeLeft = (run, ceiling) =>
  Math.min(ceiling, Math.max(1, run.deadline - Date.now()));

function clearForTests() {
  cache.clear();
  running.clear();
  recentRuns.clear();
}

module.exports = {
  cached,
  throttled,
  limiter,
  mapLimited,
  onDefaultPort,
  timeLeft,
  UNVERIFIABLE,
  RUNS_PER_WINDOW,
  clearForTests,
};
