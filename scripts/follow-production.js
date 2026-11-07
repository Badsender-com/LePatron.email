#!/usr/bin/env node
'use strict';

/**
 * A copy follows production every night (ADR 0019).
 *
 * The hosting platform's scheduler runs this command on each copy (see
 * `cron.json`); the web server runs no timer. It runs the same follow as the
 * "Follow now" button and records it as the night's. On an instance that
 * follows no production (production itself, a local install), it does
 * nothing and exits 0.
 *
 * Exit code: 0 when the follow succeeded or there was nothing to follow, 1
 * when it failed or some items failed (`partial`), so the scheduler's logs
 * show it.
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
  const report = await followProduction({
    fetchExport: source.fetchProductionExport,
    actor: NIGHT,
    trigger: 'night',
  });
  const count = (list) => (list || []).length;
  log(
    `Followed ${source.productionOrigin()}: ${report.status}` +
      (report.status === 'failed'
        ? ` (${report.reason}: ${report.message})`
        : `, ${count(report.created)} created, ${count(
            report.updated
          )} updated, ${count(report.upToDate)} up to date, ${count(
            report.kept
          )} kept, ${count(report.failed)} failed`)
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
