#!/usr/bin/env node
'use strict';

/**
 * A copy follows production every night (ADR 0019).
 *
 * The hosting platform's scheduler runs this command (`clevercloud/cron.json`
 * on Clever Cloud, `cron.json` on Scalingo); the web server runs no timer. It
 * runs the same follow as the "Follow now" button and records it as the
 * night's. It does nothing on an instance that follows no production
 * (production itself, a local install), nor on a copy whose configuration
 * does not ask for the night (`SKILLS_SOURCE_NIGHTLY=true`). The scheduler
 * runs it on every instance of the application: the first one takes the
 * follow's lock, the others find it taken, or find the night's follow
 * ended within the hour, and write nothing.
 *
 * Exit code: 0 when the follow succeeded, there was nothing to follow,
 * another follow was running, or the night was already followed; 1 when
 * it failed or some items failed (`partial`), so the scheduler's logs show
 * it.
 *
 * Usage:
 *   yarn follow-production
 *   node scripts/follow-production.js
 */

const path = require('path');

const server = (...segments) =>
  path.resolve(__dirname, '..', 'packages', 'server', ...segments);

const { followProduction } = require(server(
  'ai-skill',
  'services',
  'skills-follow.service.js'
));
const source = require(server(
  'ai-skill',
  'services',
  'skills-source-client.js'
));
const { nightFollowedSince } = require(server(
  'ai-skill',
  'services',
  'skills-follow-lock.js'
));
const ERROR_CODES = require(server('constant', 'error-codes.js'));

// The instances of an application start their scheduled command within
// minutes of each other: a night's follow started within this window is
// the night's.
const NIGHT_WINDOW_MS = 60 * 60 * 1000;

// The night follows production: no person, no user id.
const NIGHT = { id: null, name: '' };

/**
 * Follows production once, as the night.
 *
 * @param {Object} [options]
 * @param {(line: string) => void} [options.log]
 * @returns {Promise<number>} the exit code
 */
async function followTonight({ log = console.log } = {}) {
  if (!source.isConfigured()) {
    log('This instance follows no production: nothing to do.');
    return 0;
  }
  if (!source.isNightly()) {
    log(
      'This copy does not follow production at night (SKILLS_SOURCE_NIGHTLY): nothing to do.'
    );
    return 0;
  }
  if (await nightFollowedSince(new Date(Date.now() - NIGHT_WINDOW_MS))) {
    log('Production was already followed tonight: nothing to do.');
    return 0;
  }
  let report;
  try {
    report = await followProduction({
      fetchExport: source.fetchProductionExport,
      actor: NIGHT,
      trigger: 'night',
    });
  } catch (err) {
    if (err && err.message === ERROR_CODES.SKILLS_FOLLOW_RUNNING) {
      log('Another follow of production is running: nothing to do.');
      return 0;
    }
    throw err;
  }
  const count = (list) => (list || []).length;
  log(
    `Followed ${source.productionOrigin()}: ${report.status}` +
      (report.status === 'failed'
        ? ` (${report.reason}: ${report.message})`
        : `, ${count(report.created)} created, ${count(
            report.updated
          )} updated, ${count(report.upToDate)} up to date, ${count(
            report.kept
          )} kept, ${count(report.moved)} moved, ${count(
            report.removed
          )} removed, ${count(report.failed)} failed`)
  );
  return report.status === 'succeeded' ? 0 : 1;
}

async function main() {
  require('dotenv').config();
  // eslint-disable-next-line global-require
  const mongoose = require('mongoose');
  // eslint-disable-next-line global-require
  const config = require(server('node.config.js'));
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  try {
    process.exitCode = await followTonight();
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  });
}

module.exports = { followTonight };
