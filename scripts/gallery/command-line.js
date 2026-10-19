'use strict';

/**
 * The terminal side of the gallery scripts: the options, what may be printed
 * about the database, and the stop signals.
 */

const config = require('../../packages/server/node.config.js');

const DEFAULT_CONCURRENCY = 4;
const MAX_CONCURRENCY = 32;
const EXIT_INTERRUPTED = 130;

function flagValue(argv, name) {
  const flag = argv.find((arg) => arg.startsWith(name));
  return flag === undefined ? null : flag.slice(name.length);
}

function parseConcurrency(value) {
  if (value === null) return DEFAULT_CONCURRENCY;
  const concurrency = Number(value);
  if (
    !Number.isInteger(concurrency) ||
    concurrency < 1 ||
    concurrency > MAX_CONCURRENCY
  ) {
    throw new Error(
      `--concurrency takes an integer from 1 to ${MAX_CONCURRENCY}`
    );
  }
  return concurrency;
}

// A run that writes names its database: the configuration falls back on a
// default (production on an application instance, a local base elsewhere), and
// an override that did not apply would otherwise go unnoticed.
function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run');
  const database = flagValue(argv, '--database=') || null;
  if (!dryRun && !database) {
    throw new Error(
      'A run without --dry-run writes: name its database with ' +
        '--database=<name>, as the dry-run prints it.'
    );
  }
  const concurrency = parseConcurrency(flagValue(argv, '--concurrency='));
  return { dryRun, concurrency, database };
}

function confirmDatabase(connected, database) {
  if (database && database !== connected) {
    throw new Error(
      `--database=${database} does not match the database this run is ` +
        `connected to, "${connected}". Nothing was written.`
    );
  }
}

// The hosts of a connection string, never its credentials: the URI carries the
// database password, and this output ends up in terminals and job logs.
// Parsed by hand because `new URL` rejects a replica set's host list.
function databaseHosts(uri) {
  const match = /^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/.exec(uri || '');
  return match ? match[1] : 'an unparsable connection string';
}

// Driver errors can quote the connection string back.
function redact(message) {
  return String(message)
    .split(config.database)
    .join('<database URI>')
    .replace(/\/\/[^@/\s]+@/g, '//<credentials>@');
}

// Ctrl-C (or the platform stopping the job) lets the galleries in progress
// finish their current file, then prints the summary: a resumable run should
// say where it stopped. A second one exits at once, the run being resumable.
// A script can stop the run too, with its reason (`stopFor`).
function listenForStop() {
  const signal = { stopping: false, reason: null, interrupts: 0 };
  signal.stopFor = (reason) => {
    if (!signal.stopping) console.log(`\nStopping: ${reason}`);
    signal.stopping = true;
    signal.reason = signal.reason || reason;
  };
  const interrupt = () => {
    signal.interrupts += 1;
    if (signal.interrupts > 1) {
      console.error('Second interrupt: exiting now. Rerun to resume.');
      process.exit(EXIT_INTERRUPTED);
    }
    if (!signal.stopping) {
      console.log('\nStopping after the galleries in progress…');
    }
    signal.stopping = true;
  };
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
  signal.release = () => {
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
  };
  return signal;
}

module.exports = {
  parseArgs,
  confirmDatabase,
  databaseHosts,
  redact,
  listenForStop,
  DEFAULT_CONCURRENCY,
  MAX_CONCURRENCY,
};
